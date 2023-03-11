import { QuickPickItem, window, QuickInputButton, ExtensionContext, Uri, ProgressLocation, workspace } from 'vscode';
import { ProjectStepInput } from './baseProjectWizard';
import { spawnSync } from 'child_process';
import { findJavaHomes, JavaRuntime } from '../java-runtime/findJavaHomes';
import Constants from '../constants';
import { downloadJarFile } from '../utils';

export async function initLiferayWorkpsceProject(context: ExtensionContext, workspaceType: string) {

	class MyButton implements QuickInputButton {
		constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
	}

	const createResourceGroupButton = new MyButton({
		dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
		light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
	}, 'Create Resource Group');

	interface State {
		title: string;
		step: number;
		totalSteps: number;
		workspaceProduct: QuickPickItem | string;
		name: string;
		path: string;
		runtime: QuickPickItem;
	}

	async function initLiferayWorkspace() {
		const state = {} as Partial<State>;
		await ProjectStepInput.run(input => setWorkspaceName(input, state));
		return state as State;
	}

	const title = 'Create Liferay Gradle Workspace Project';

	async function setWorkspaceProduct(input: ProjectStepInput, state: Partial<State>) {
		
		const loadingItems: QuickPickItem[] = [{ label: 'Loading.....', description: 'Wait to load workspace product versions' }];
		const pick = await input.showQuickPick({
			title,
			step: 2,
			totalSteps: 3,
			placeholder: 'Please choose a prodcut version:',
			items: loadingItems,
			activeItem: typeof state.workspaceProduct !== 'string' ? state.workspaceProduct : undefined,
			buttons: [],
			shouldResume: shouldResume,
			initQuickItems: getAvailableProductVersions
		});
		if (pick instanceof MyButton) {
			return (input: ProjectStepInput) => inputResourceGroupName(input, state);
		}
		state.workspaceProduct = pick;
		return (input: ProjectStepInput) => setWorkspacePath(input, state);
	}

	async function getAvailableProductVersions(): Promise<QuickPickItem[]> {
		const bladeJarPath = await downloadJarFile(Constants.BLADE_DOWNLOAD_URL,"blade.jar");

		let productVersions: string[] = [];

		let javahome : JavaRuntime[] = await findJavaHomes();

		const result  = spawnSync(javahome[0].home + '/bin/java', ['-jar', bladeJarPath, 'init', '--list'], { encoding: 'utf-8' });

		if (result.status !== 0) {
			console.error(result.stderr);
		  }

		productVersions =  result.stdout.split('\n');

		return productVersions.map(label => ({ label }));
	}

	async function inputResourceGroupName(input: ProjectStepInput, state: Partial<State>) {
		state.workspaceProduct = await input.showInputBox({
			title,
			step: 2,
			totalSteps: 4,
			value: typeof state.workspaceProduct === 'string' ? state.workspaceProduct : '',
			prompt: 'Choose a unique name for the resource groupqqqqqqqqqqqqqqqqqq',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: ProjectStepInput) => setWorkspaceName(input, state);
	}

	async function setWorkspacePath(input: ProjectStepInput, state: Partial<State>) {
		// TODO: Remember current value when navigating back.
		state.path = await input.showInputBox({
			title,
			step: 3,
			totalSteps: 3,
			value: state.path || '',
			prompt: 'Please set project path for liferay gradle workspace',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
	}

	async function setWorkspaceName(input: ProjectStepInput, state: Partial<State>) {
		const additionalSteps = typeof state.name === 'string' ? 1 : 0;
		// TODO: Remember current value when navigating back.
		state.name = await input.showInputBox({
			title,
			step: 1,
			totalSteps: 3,
			value: state.name || '',
			prompt: 'Choose a unique name for liferay gradle workspace project',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: ProjectStepInput) => setWorkspaceProduct(input, state);
	}

	function shouldResume() {
		// Could show a notification with the option to resume.
		return new Promise<boolean>((_resolve, _reject) => {

		});
	}

	async function validateNameIsUnique(name: string) {
		// ...validate...
		await new Promise(resolve => setTimeout(resolve, 1000));
		return name === 'vscode' ? 'Name not unique' : undefined;
	}

	const state = await initLiferayWorkspace();
	window.showInformationMessage(`Creating Application Service '${state.name}'`);
	
	const version =state.workspaceProduct as QuickPickItem;
	const moduleType = state.runtime as QuickPickItem;

	console.log("workspaceType is " + workspaceType);
	console.log("product version is " + version.label);
	console.log("runtime version is " + moduleType.label);
	console.log("workspace path is " + state.path);

}
