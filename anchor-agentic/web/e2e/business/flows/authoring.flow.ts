import type { Page } from '@playwright/test';
import { AgentDetailPage, NewAgentPage } from '../pages/agent.page';
import { NewRolePage, RoleDetailPage } from '../pages/role.page';
import { NewSkillPage, SkillDetailPage } from '../pages/skill.page';
import { NewWorkflowPage, WorkflowDetailPage, type StepType } from '../pages/workflow.page';
import { log } from '../support/log';
import { PUBLISHABLE } from '../support/test-data';

const FLOW = 'AuthoringFlow';

export interface TaskSpec {
	name: string;
	instructions?: string;
}

export interface AgentSetup {
	role: RoleDetailPage;
	agent: AgentDetailPage;
	roleName: string;
	taskNames: string[];
}

/** Creating and wiring up Roles, Tasks, Agents, Skills and Workflows (Epic B). */
export class AuthoringFlow {
	constructor(private readonly page: Page) {}

	async createRole(name: string, description?: string): Promise<RoleDetailPage> {
		log.step(FLOW, `Creating Role "${name}"`);
		const newRole = new NewRolePage(this.page);
		await newRole.open();
		const role = await newRole.create(name, description);
		log.ok(FLOW, `Role created at ${role.url}`);
		return role;
	}

	/** Creates a Role, then its Tasks (the page stays on the Role after each). */
	async createRoleWithTasks(roleName: string, tasks: TaskSpec[]): Promise<RoleDetailPage> {
		const role = await this.createRole(roleName);
		for (const task of tasks) {
			log.step(FLOW, `Creating Task "${task.name}"`);
			await role.createTask(task.name, task.instructions);
		}
		return role;
	}

	async createAgentForRole(roleName: string, systemPrompt?: string): Promise<AgentDetailPage> {
		log.step(FLOW, `Creating Agent for Role "${roleName}"`);
		const newAgent = new NewAgentPage(this.page);
		await newAgent.open();
		const agent = await newAgent.create(roleName, systemPrompt);
		await agent.waitForHydration();
		log.ok(FLOW, `Agent created at ${agent.url}`);
		return agent;
	}

	async assignTasks(agent: AgentDetailPage, taskNames: string[]) {
		for (const name of taskNames) {
			log.step(FLOW, `Assigning Task "${name}"`);
			await agent.assignTask(name);
		}
	}

	/**
	 * Role + Tasks + Agent with every Task assigned: the minimum an Agent needs
	 * to pass the publish gates (US-043: prompt + at least one assigned Task).
	 */
	async createPublishableAgent(
		roleName: string,
		taskNames: string[],
		systemPrompt: string = PUBLISHABLE.agentPrompt
	): Promise<AgentSetup> {
		const role = await this.createRoleWithTasks(
			roleName,
			taskNames.map((name) => ({ name }))
		);
		const agent = await this.createAgentForRole(roleName, systemPrompt);
		await this.assignTasks(agent, taskNames);
		return { role, agent, roleName, taskNames };
	}

	async createSkill(name: string, content: string = PUBLISHABLE.skillContent): Promise<SkillDetailPage> {
		log.step(FLOW, `Creating Skill "${name}"`);
		const newSkill = new NewSkillPage(this.page);
		await newSkill.open();
		const skill = await newSkill.create(name, content);
		log.ok(FLOW, `Skill created at ${skill.url}`);
		return skill;
	}

	async createWorkflow(name: string, description?: string): Promise<WorkflowDetailPage> {
		log.step(FLOW, `Creating Workflow "${name}"`);
		const newWorkflow = new NewWorkflowPage(this.page);
		await newWorkflow.open();
		const workflow = await newWorkflow.create(name, description);
		await workflow.waitForHydration();
		log.ok(FLOW, `Workflow created at ${workflow.url}`);
		return workflow;
	}

	async addSteps(workflow: WorkflowDetailPage, steps: { type: StepType; label?: string }[]) {
		for (const step of steps) {
			log.step(FLOW, `Adding ${step.type} step${step.label ? ` "${step.label}"` : ''}`);
			await workflow.addStep(step.type, step.label);
		}
	}

	/** Builds a Workflow and populates it with steps in one go. */
	async createWorkflowWithSteps(
		name: string,
		steps: { type: StepType; label?: string }[],
		description?: string
	): Promise<WorkflowDetailPage> {
		const workflow = await this.createWorkflow(name, description);
		await this.addSteps(workflow, steps);
		return workflow;
	}

	/** US-012: change a step's type and/or referenced item in place. */
	async editStep(workflow: WorkflowDetailPage, index: number, type: StepType, label: string) {
		log.step(FLOW, `Editing step ${index + 1} to ${type} "${label}"`);
		await workflow.editStep(index, type, label);
		log.ok(FLOW, `Step ${index + 1} is now ${type} "${label}"`);
	}

	/** US-012: remove a step, then confirm the remaining steps stay contiguous after a reload. */
	async removeStepAndExpectRemaining(
		workflow: WorkflowDetailPage,
		index: number,
		remaining: { type: StepType; label: string }[]
	) {
		log.step(FLOW, `Removing step ${index + 1}`);
		await workflow.removeStep(index);
		await workflow.expectStepCount(remaining.length);
		await this.page.reload();
		await workflow.expectStepCount(remaining.length);
		for (const [i, step] of remaining.entries()) {
			await workflow.expectStepAt(i, step.type, step.label);
		}
		log.ok(FLOW, 'Remaining steps are contiguous and in order');
	}

	/** US-012: reorder (move last step up) and remove (gapless renumbering), then verify persistence. */
	async reorderAndRemoveSteps(workflow: WorkflowDetailPage) {
		log.step(FLOW, 'Moving last step up');
		await workflow.moveStepUp(2);
		await workflow.expectStepTypes('TASK', 'SKILL', 'AGENT');

		log.step(FLOW, 'Removing last step');
		await workflow.removeStep(2);
		await workflow.expectStepCount(2);
		await workflow.expectStepTypes('TASK', 'SKILL');

		log.step(FLOW, 'Reloading to confirm persistence');
		await this.page.reload();
		await workflow.expectStepCount(2);
		await workflow.expectStepTypes('TASK', 'SKILL');
		log.ok(FLOW, 'Step order persisted');
	}
}
