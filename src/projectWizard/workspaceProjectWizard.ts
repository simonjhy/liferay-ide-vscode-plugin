import { QuickPickItem, window, ExtensionContext } from 'vscode';
import { ProjectStepInput } from './baseProjectWizard';
import { spawnSync } from 'child_process';
import { findJavaHomes, JavaRuntime } from '../java-runtime/findJavaHomes';
import Constants from '../constants';
import { downloadFile, getBladeJar, getJavaExecutable, getProductInfos, openCurrentLiferayWorkspaceProject } from '../liferayUtils';
import path = require('path');


export async function initLiferayWorkpsceProject(context: ExtensionContext, workspaceType: string) {

	interface State {
		title: string;
		step: number;
		totalSteps: number;
		workspaceProduct: QuickPickItem | string;
		targetPlatform: QuickPickItem | string;
		name: string;
		path: string;
		runtime: QuickPickItem;
	}

	async function initLiferayWorkspace() {
		const state = {} as Partial<State>;
		await ProjectStepInput.run(input => setWorkspacePath(input, state));
		return state as State;
	}

	const title = 'Create Liferay Workspace Project';

	async function setWorkspaceProduct(input: ProjectStepInput, state: Partial<State>) {
		
		const loadingItems: QuickPickItem[] = [{ label: 'Loading.....', description: 'Wait to load workspace product versions' }];
		const pick = await input.showQuickPick({
			title,
			step: 3,
			totalSteps: 3,
			placeholder: 'Please choose a prodcut version:',
			items: loadingItems,
			activeItem: typeof state.workspaceProduct !== 'string' ? state.workspaceProduct : undefined,
			buttons: [],
			shouldResume: shouldResume,
			initQuickItems: getAvailableProductVersions
		});

		state.workspaceProduct = pick;
	}

	
	async function setWorkspaceTargetPlatform(input: ProjectStepInput, state: Partial<State>) {
		const loadingItems: QuickPickItem[] = [{ label: 'Loading.....', description: 'Wait to load workspace target platform versions' }];

		const pick = await input.showQuickPick({
			title,
			step: 3,
			totalSteps: 3,
			placeholder: 'Please choose a target platform version:',
			items: loadingItems,
			activeItem: typeof state.targetPlatform !== 'string' ? state.targetPlatform : undefined,
			buttons: [],
			shouldResume: shouldResume,
			initQuickItems: getAvailableTargetPlatformVersions
		});

		state.targetPlatform = pick;
	}

	async function getAvailableTargetPlatformVersions(): Promise<QuickPickItem[]> {
		const bladeJarPath = await getBladeJar();
		
		let productVersions: string[] = [];

		let javahome : JavaRuntime[] = await findJavaHomes();

		const result  = spawnSync(getJavaExecutable(javahome[0]), ['-jar', bladeJarPath, 'init', '--list'], { encoding: 'utf-8' });

		productVersions =  result.stdout.split('\n');

		const productInfoMap = await getProductInfos();

		let taretPlatformVersions: string[] = [];

		productVersions.forEach((version) => {
			let productInfo = productInfoMap.get(version);

			if (productInfo !== undefined){
				taretPlatformVersions.push(productInfo.targetPlatformVersion);
			}
		});

		return taretPlatformVersions.map(label => ({ label }));
	}


	async function getAvailableProductVersions(): Promise<QuickPickItem[]> {
		const bladeJarPath = await getBladeJar();

		let productVersions: string[] = [];

		let javahome : JavaRuntime[] = await findJavaHomes();

		const result  = spawnSync(getJavaExecutable(javahome[0]), ['-jar', bladeJarPath, 'init', '--list'], { encoding: 'utf-8' });

		if (result.status !== 0) {
			console.error(result.stderr);
		  }

		productVersions =  result.stdout.split('\n');

		return productVersions.map(label => ({ label }));
	}

	async function setWorkspacePath(input: ProjectStepInput, state: Partial<State>) {
		state.path = await input.showInputBox({
			title,
			step: 1,
			totalSteps: 3,
			value: state.path || '',
			prompt: 'Please set project path for liferay gradle workspace',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: ProjectStepInput) => setWorkspaceName(input, state);
	}

	async function setWorkspaceName(input: ProjectStepInput, state: Partial<State>) {
		const additionalSteps = typeof state.name === 'string' ? 1 : 0;
		state.name = await input.showInputBox({
			title,
			step: 2,
			totalSteps: 3,
			value: state.name || '',
			prompt: 'Choose a unique name for liferay gradle workspace project',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});

		if (workspaceType === "Gradle"){
			return (input: ProjectStepInput) => setWorkspaceProduct(input, state);
		}
		else{
			return (input: ProjectStepInput) => setWorkspaceTargetPlatform(input, state);
		}
	}

	function shouldResume() {
		return new Promise<boolean>((_resolve, _reject) => {

		});
	}

	async function validateNameIsUnique(name: string) {
		await new Promise(resolve => setTimeout(resolve, 1000));
		return name === 'vscode' ? 'Name not unique' : undefined;
	}

	async function bladeInitWorkspace(): Promise<void> {
		const bladeJarPath = await downloadFile(Constants.BLADE_DOWNLOAD_URL, Constants.BLADE_CACHE_DIR, Constants.BALDE_JAR_NAME);
		let javahome : JavaRuntime[] = await findJavaHomes();
		let  version: QuickPickItem;

		if (workspaceType === 'Gradle'){
			version = state.workspaceProduct as QuickPickItem;
		}
		else{
			version = state.targetPlatform as QuickPickItem;
		}

		const result  = spawnSync(getJavaExecutable(javahome[0]), ['-jar', bladeJarPath, 'init', '-v', version.label, '-b', workspaceType.toLocaleLowerCase(), '--base', path.resolve(state.path), state.name], { encoding: 'utf-8' });

		if (result.status !== 0) {
			throw new Error(`Failed to init a ${workspaceType} liferay worksapce project in ${state.path}`);
		}

		openCurrentLiferayWorkspaceProject(path.join(path.resolve(state.path), state.name));
	}

	const state = await initLiferayWorkspace();

	window.showInformationMessage(`Creating Application Service '${state.name}' in '${state.path}'`);

	bladeInitWorkspace();
}
