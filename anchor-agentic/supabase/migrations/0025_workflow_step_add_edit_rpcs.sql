-- Atomic Workflow step add and edit (US-010, US-012). Follows 0024: the insert
-- or update of the step, the single current_version bump, and the version
-- snapshot now happen in one transaction under a lock on the workflow row.
-- Previously these were separate API->Postgres calls, so a failure after the
-- step write left a changed Workflow with no new version or snapshot.
--
-- SECURITY INVOKER (the caller's RLS still applies) and an explicit
-- owner_id = auth.uid() lock, exactly as in 0024. The API still validates the
-- reference (exactly one field, matching step_type, and that the caller may
-- reference the item); the table CHECK constraint is the database backstop.

create or replace function public.add_workflow_step(
  p_workflow_id uuid,
  p_step_type text,
  p_task_id uuid,
  p_agent_id uuid,
  p_skill_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
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

  -- Server-assigned: always appended at the end (order_index stays gapless).
  insert into public.workflow_steps (workflow_id, order_index, step_type, task_id, agent_id, skill_id)
  values (
    p_workflow_id,
    (select count(*) from public.workflow_steps where workflow_id = p_workflow_id),
    p_step_type, p_task_id, p_agent_id, p_skill_id
  );

  return public._workflow_bump_and_snapshot(p_workflow_id);
end;
$$;

-- order_index is never touched by an edit.
create or replace function public.update_workflow_step(
  p_workflow_id uuid,
  p_step_id uuid,
  p_step_type text,
  p_task_id uuid,
  p_agent_id uuid,
  p_skill_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
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

  update public.workflow_steps
     set step_type = p_step_type, task_id = p_task_id, agent_id = p_agent_id, skill_id = p_skill_id
   where id = p_step_id and workflow_id = p_workflow_id;
  if not found then
    raise exception 'step_not_found';
  end if;

  return public._workflow_bump_and_snapshot(p_workflow_id);
end;
$$;

revoke all on function public.add_workflow_step(uuid, text, uuid, uuid, uuid) from public, anon;
revoke all on function public.update_workflow_step(uuid, uuid, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.add_workflow_step(uuid, text, uuid, uuid, uuid) to authenticated;
grant execute on function public.update_workflow_step(uuid, uuid, text, uuid, uuid, uuid) to authenticated;
