-- Atomic Workflow step mutations (US-011, US-012). Deleting or reordering a
-- step used to be a chain of separate API->Postgres calls (delete, two-phase
-- renumber, version bump, snapshot insert, second version bump), so a failure
-- midway left gaps, negative order_index values, or a version with no
-- snapshot. These functions do the whole mutation in one transaction.
--
-- SECURITY INVOKER on purpose: the caller's own RLS policies still apply, so
-- this is a second enforcement layer behind the API's ownership checks, never
-- a bypass. The explicit owner_id = auth.uid() lock below is belt-and-braces.
--
-- The workflow row is locked FOR UPDATE first, so two concurrent edits to the
-- same Workflow queue up instead of renumbering against stale step lists.
-- Each call bumps current_version exactly once and writes one version
-- snapshot of the same shape api/src/routes/workflows.ts used to build
-- (workflow columns + steps).

create or replace function public._workflow_bump_and_snapshot(p_workflow_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workflow jsonb;
  v_steps jsonb;
  v_next integer;
begin
  update public.workflows
     set current_version = current_version + 1, updated_at = now()
   where id = p_workflow_id
  returning current_version into v_next;

  select jsonb_build_object(
           'id', w.id, 'owner_id', w.owner_id, 'name', w.name, 'description', w.description,
           'status', w.status, 'current_version', w.current_version,
           'published_version', w.published_version, 'created_at', w.created_at,
           'updated_at', w.updated_at)
    into v_workflow
    from public.workflows w
   where w.id = p_workflow_id;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.order_index), '[]'::jsonb)
    into v_steps
    from public.workflow_steps s
   where s.workflow_id = p_workflow_id;

  insert into public.version_snapshots (item_type, item_id, version_number, snapshot_data, created_by)
  values ('WORKFLOW', p_workflow_id, v_next, v_workflow || jsonb_build_object('steps', v_steps), auth.uid());

  return jsonb_build_object('workflow', v_workflow, 'steps', v_steps);
end;
$$;

-- Closes gaps: rewrites order_index to 0..n-1 following the current order.
-- Two phases because unique (workflow_id, order_index) is checked per row.
create or replace function public._workflow_close_gaps(p_workflow_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.workflow_steps
     set order_index = -(order_index + 1)
   where workflow_id = p_workflow_id;

  update public.workflow_steps s
     set order_index = r.new_index
    from (
      select id, (row_number() over (order by order_index desc) - 1)::integer as new_index
        from public.workflow_steps
       where workflow_id = p_workflow_id
    ) r
   where s.id = r.id;
end;
$$;

create or replace function public.delete_workflow_step(p_workflow_id uuid, p_step_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_count integer;
begin
  select status into v_status
    from public.workflows
   where id = p_workflow_id and owner_id = auth.uid()
     for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_status = 'Archived' then
    raise exception 'archived_item_is_terminal';
  end if;

  select count(*) into v_count from public.workflow_steps where workflow_id = p_workflow_id;
  if not exists (select 1 from public.workflow_steps where id = p_step_id and workflow_id = p_workflow_id) then
    raise exception 'step_not_found';
  end if;
  -- US-012 AC4: a Published Workflow may never have zero steps.
  if v_status = 'Published' and v_count = 1 then
    raise exception 'workflow_has_no_steps';
  end if;

  delete from public.workflow_steps where id = p_step_id and workflow_id = p_workflow_id;
  perform public._workflow_close_gaps(p_workflow_id);
  return public._workflow_bump_and_snapshot(p_workflow_id);
end;
$$;

-- p_step_ids carries every existing step id in its new order.
create or replace function public.reorder_workflow_steps(p_workflow_id uuid, p_step_ids uuid[])
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_existing uuid[];
begin
  select status into v_status
    from public.workflows
   where id = p_workflow_id and owner_id = auth.uid()
     for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_status = 'Archived' then
    raise exception 'archived_item_is_terminal';
  end if;

  select coalesce(array_agg(id), '{}') into v_existing
    from public.workflow_steps where workflow_id = p_workflow_id;
  if coalesce(array_length(p_step_ids, 1), 0) <> coalesce(array_length(v_existing, 1), 0)
     or (select count(distinct x) from unnest(p_step_ids) x) <> coalesce(array_length(p_step_ids, 1), 0)
     or not (p_step_ids <@ v_existing) then
    raise exception 'step_set_mismatch';
  end if;

  update public.workflow_steps
     set order_index = -(order_index + 1)
   where workflow_id = p_workflow_id;

  update public.workflow_steps s
     set order_index = (o.ord - 1)::integer
    from unnest(p_step_ids) with ordinality as o(id, ord)
   where s.id = o.id and s.workflow_id = p_workflow_id;

  return public._workflow_bump_and_snapshot(p_workflow_id);
end;
$$;

revoke all on function public._workflow_bump_and_snapshot(uuid) from public, anon;
revoke all on function public._workflow_close_gaps(uuid) from public, anon;
revoke all on function public.delete_workflow_step(uuid, uuid) from public, anon;
revoke all on function public.reorder_workflow_steps(uuid, uuid[]) from public, anon;
grant execute on function public._workflow_bump_and_snapshot(uuid) to authenticated;
grant execute on function public._workflow_close_gaps(uuid) to authenticated;
grant execute on function public.delete_workflow_step(uuid, uuid) to authenticated;
grant execute on function public.reorder_workflow_steps(uuid, uuid[]) to authenticated;
