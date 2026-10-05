import { ItemDetailPage } from './item-detail.page';

/** `/tasks/[id]` — Task editor (Tasks are never independently publishable; they can be archived). */
export class TaskDetailPage extends ItemDetailPage {
	protected readonly routeSegment = 'tasks';
}
