/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickPickItem, window, QuickInputButton, ExtensionContext, Uri } from 'vscode';
import { ProjectStepInput } from './baseProjectWizard';
import { exec, execFile, spawn, spawnSync } from 'child_process';
import { findJavaHomes, JavaRuntime } from '../java-runtime/findJavaHomes';
import Constants from '../constants';
import { downloadFile, findMatchingWorkspaceFolder,  findTagsWithCssSelector,  getCurrentWorkspacePath, getJavaExecutable, getProductInfos, refreshWorkspaceView } from '../liferayUtils';
import path = require('path');
import { isLiferayGradleWorkspace } from '../workspaceUtil';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import * as properties from "properties-parser";
import * as os from 'os';
import * as zlib from 'zlib';
import * as tar from 'tar';

export async function createLiferayClientExtensionProject(context: ExtensionContext) {

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
		extensionType: QuickPickItem | string;
		name: string;
		extensionName: string;
	}

	async function initLiferayClientExtension() {
		const state = {} as Partial<State>;
		await ProjectStepInput.run(input => setClientExtensionProjectName(input, state));
		return state as State;
	}

	const title = 'Create Liferay Client Extension Project';

	async function setLiferayClientExtensinType(input: ProjectStepInput, state: Partial<State>) {
		const loadingItems: QuickPickItem[] = [{ label: 'Loading.....', description: 'Wait to load liferay client extension types' }];
		const pick = await input.showQuickPick({
			title,
			step: 2,
			totalSteps: 3,
			placeholder: 'Choose a Liferay Client Extenstion Type:',
			items: loadingItems,
			activeItem: typeof state.extensionType !== 'string' ? state.extensionType : undefined,
			buttons: [],
			shouldResume: shouldResume,
			initQuickItems: getAvailableClientExtensinTypes
		});
		state.extensionType = pick;
		return (input: ProjectStepInput) => setLifreayClientExtensionName(input, state);
	}

	async function getExtensionMetadataFile(): Promise<string>{
		return "";
	}

	async function upzip(zipPath: string, output: string){
		if (!fs.existsSync(output)) {
			fs.mkdirSync(output);
		}

		const unzip = zlib.createUnzip();
		const untar = tar.extract({
			cwd: output, 
		});

		const readStream = fs.createReadStream(zipPath);

		readStream.pipe(unzip)
			.pipe(untar)
			.on('error', (err) => {
				console.error('Failed unzip：', err);
			})
			.on('close', () => {
				console.log('Finish unzip.');
		});
	}

	function getWorkspaceProduct():any{
		const workspacePath = getCurrentWorkspacePath();

		if (!workspacePath){
			throw new Error("Failed to get current workspace project path");
		}

		if (workspacePath){
			if (isLiferayGradleWorkspace(workspacePath)){
				const gradlePropertiesPath = path.join(workspacePath, "gradle.properties");
				const props = properties.read(gradlePropertiesPath);
				return props[Constants.LIFERAY_WORKSPACE_PRODUCT];
			}
		}

		return null;
	}

	async function createSha256(file: string): Promise<string> {
	  const stream = createReadStream(file);
	  const hash = createHash('sha256');
	  return new Promise((resolve, reject) => {
		stream.on('data', (chunk: Buffer) => {
		  hash.update(chunk);
		});
		stream.on('end', () => {
		  const digest = hash.digest('hex');
		  resolve(digest);
		});
		stream.on('error', (err: Error) => {
		  reject(err);
		});
	  });
	}

	async function getLxc(): Promise<string> {
		const lxcCacheDir = path.join(os.homedir(), Constants.CLIENT_EXTENSION_CACHE_DIR);

		const lxcUnzipPath = path.join(lxcCacheDir, "lxc");
		let  lxcFilePath = path.join(lxcUnzipPath, 'lxc');

		const archType = process.platform;
		switch (archType) {
			case 'win32':
				lxcFilePath = lxcFilePath.concat('.exe');
				break;
			break;
			case 'linux':
			case 'darwin':
			break;
			default:
		}

		if (fs.existsSync(lxcFilePath)){
			return lxcFilePath;
		}

		const lxcUrl = Constants.LXC_DOWNLOAD_URL;

		let lxcName: string;

		switch (archType) {
			case 'win32':
				lxcName = "lxc-win";
			break;
			case 'linux':
				lxcName = "lxc-linux";
			break;
			case 'darwin':
				lxcName = "lxc-macos";
			break;
			default:
			throw new Error("Your platform is not supported.");
		}

		
		const lxcZipPath = path.join(lxcCacheDir, lxcName).concat(".tgz");
		const lxcZipChecksumPath = path.join(lxcCacheDir, lxcName).concat(".tgz").concat(".checksum")

		if (fs.existsSync(lxcZipPath) && fs.existsSync(lxcZipChecksumPath)){
			const sha256 = await createSha256(lxcZipPath);

			const lxcChecksum = fs.readFileSync(lxcZipChecksumPath, 'utf-8');

			if (sha256 === lxcChecksum.toString()){
				upzip(lxcZipPath, path.join(lxcCacheDir, "lxc") );
				return lxcFilePath;
			}

			fs.unlink(lxcZipPath, (err) => {
				if (err) {
				  console.error(err);
				}
			});
			fs.unlink(lxcZipChecksumPath, (err) => {
				if (err) {
				  console.error(err);
				}
			});
		}

		const lxcDownloadUrl = lxcUrl.concat(lxcName).concat(".tgz");

		const lxcDownloadChecksumUrl = lxcDownloadUrl.concat(".checksum");

		const lxcDowanloadPath = await downloadFile(lxcDownloadUrl, Constants.CLIENT_EXTENSION_CACHE_DIR, lxcName.concat(".tgz"));

		const lxcDowanloadChecksumPath = await downloadFile(lxcDownloadUrl.concat(".checksum"), Constants.CLIENT_EXTENSION_CACHE_DIR, lxcName.concat(".checksum"));

		if (fs.existsSync(lxcDowanloadChecksumPath) && fs.existsSync(lxcDowanloadPath)){
			const sha256 = await createSha256(lxcDowanloadPath);
			
			const lxcChecksum = fs.readFileSync(lxcDowanloadChecksumPath, 'utf-8');

			if (sha256 === lxcChecksum.toString()){
				upzip(lxcDowanloadPath, path.join(lxcCacheDir, "lxc") );
				return lxcFilePath;
			}

			throw new Error("Failed to verify check sum lxc.");
		}

		throw new Error("Failed to download lxc.");
	}

	async function getAvailableClientExtensinTypes(): Promise<QuickPickItem[]> {
		const clientExtensionApiJarVersion = await getWorkspaceClientExtensinApiJarVersion();

		const clientExtensionApiJarDownloaUrl = Constants.BASE_RELEASE_URL + "/content/com/liferay/com.liferay.client.extension.type.api/" + clientExtensionApiJarVersion +
			"/com.liferay.client.extension.type.api-" + clientExtensionApiJarVersion + ".jar";

		const clientExtensionApiJarPath = await downloadFile(clientExtensionApiJarDownloaUrl, Constants.CLIENT_EXTENSION_CACHE_DIR, "com.liferay.client.extension.type.api-" + clientExtensionApiJarVersion + ".jar");

		const clientExtensionTypes = await getJarClassNames(clientExtensionApiJarPath, "com/liferay/client/extension/type");

		return clientExtensionTypes.filter(item => item.length >1).map(label => ({ label }));
	}

	async function getWorkspaceClientExtensinApiJarVersion(): Promise<string> {
		const workspacePath = getCurrentWorkspacePath();

		if (!workspacePath){
			window.showInformationMessage(`${workspacePath} workspae project is invalid.`);
			throw new Error(`${workspacePath} workspae project is invalid.`);
		}

		const productKey = getWorkspaceProduct();

		if (!productKey){
			window.showInformationMessage(`${workspacePath} workspae project is not set product key.`);
			throw new Error(`${workspacePath} workspae project is not set product key.`);
		}

		const productInfos = await getProductInfos();

		const productInfo = productInfos.get(productKey);

		const targetPlatformVersion = productInfo?.targetPlatformVersion;

		const firstDashIndex = productKey.indexOf("-"); // 获取第一个横线的索引位置

		const productType = productKey.substring(0, firstDashIndex);

		const releaseBomFileUrl = Constants.BASE_BOM_URL + "release." + productType + ".bom/" + targetPlatformVersion + "/release." + productType + ".bom-" + targetPlatformVersion + ".pom";

        const releaseBomPath = await downloadFile(releaseBomFileUrl, Constants.CLIENT_EXTENSION_CACHE_DIR, "release." + productType + ".bom-" + targetPlatformVersion + ".pom");

		return findTagsWithCssSelector(releaseBomPath, "com.liferay.client.extension.type.api");
	}


	function getJarClassNames(jarPath: string, directory: string): Promise<string[]> {
		return new Promise((resolve, reject) => {
		  let command = '';
		  if (os.platform() === 'win32') {
			command = `jar tf ${jarPath.replace(/\//g, '/')} | findstr /i ""${directory}" | findstr /i "\.class$"`;
		  } else {
			command = `jar tf ${jarPath} | grep -i "${directory}" | grep -i "\.class$"`;
		  }
		  exec(command, (error, stdout, stderr) => {
			if (error) {
			  reject(error);
			} else if (stderr) {
			  reject(new Error(stderr.trim()));
			} else {
				const classNames = stdout.trim().split('\n')
				.filter(name => {
					const index = name.lastIndexOf('/');
					const packageName = name.substring(0,index);
					if (packageName === directory){
						return true;
					}
					return false;
				})
				.filter(name => name.indexOf('.class')>0)
				.map(name => name.replace(directory, ''))
				.map(name => name.replace('/', ''))
				.filter(name => !(name === 'CET'))
				.filter(name => name.length >1)
				.map(name => name.replace('CET', ''))
				.map(name => name.replace('.class', ''));
					// .map(name => name.charAt(0).toLowerCase() + name.slice(1));
			  resolve(classNames);
			}
		  });
		});
	  }

	async function setClientExtensionProjectName(input: ProjectStepInput, state: Partial<State>) {
		state.name = await input.showInputBox({
			title,
			step: 1,
			totalSteps: 3,
			value: state.name || '',
			prompt: 'Choose a unique name for Liferay Client Extension Project',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: ProjectStepInput) => setLiferayClientExtensinType(input, state);
	}


	async function setLifreayClientExtensionName(input: ProjectStepInput, state: Partial<State>) {
		state.extensionName = await input.showInputBox({
			title,
			step: 3,
			totalSteps: 3,
			value: state.extensionName || '',
			prompt: 'Choose a client extension name',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
	}

	function shouldResume() {
		// Could show a notification with the option to resume.
		return new Promise<boolean>((_resolve, _reject) => {

		});
	}

	async function validateNameIsUnique(name: string) {
		const result = findMatchingWorkspaceFolder(name);
		if (result && result.match) {
			return 'Name not unique';
		}
		return undefined;
	}

	async function bladeCreateClientExtensionProject(): Promise<void> {
		let workspacePath = getCurrentWorkspacePath();

		if (workspacePath){
			const bladeJarPath = await downloadFile(Constants.BLADE_DOWNLOAD_URL, Constants.BLADE_CACHE_DIR, Constants.BALDE_JAR_NAME);
		
			let extensionType = state.extensionType as QuickPickItem;
			let extensionTypeString = extensionType.label;
			const commandExtensionType = extensionTypeString.charAt(0).toLowerCase() + extensionTypeString.slice(1)

			let javahome : JavaRuntime[] = await findJavaHomes();

			const result  = spawnSync(getJavaExecutable(javahome[0]), ['-jar', bladeJarPath, 'create', '--base', workspacePath,  '-t', 'client-extension', '-d', path.join(workspacePath,state.name), '--extension-name', state.extensionName, '--extension-type', commandExtensionType , state.name]);
			
			if (result.status !== 0) {
				throw new Error(`Failed to create a ${extensionType} liferay worksapce project for ${state.name}`);
			}
			
			refreshWorkspaceView();

			window.showInformationMessage(`Creating Client Extension Project '${state.name}'`);
		}
	}

	async function lxcCreateClientExtensionProject(): Promise<void> {
		const lxcPath = await getLxc();

		let extensionType = state.extensionType as QuickPickItem;

		const workspacePath = getCurrentWorkspacePath();

		if (workspacePath){
			const clientExtensionApiJarVersion = await getWorkspaceClientExtensinApiJarVersion();

			const clientExtensionApiJarDownloaUrl = Constants.BASE_RELEASE_URL + "/content/com/liferay/com.liferay.client.extension.type.api/" + clientExtensionApiJarVersion +
				"/com.liferay.client.extension.type.api-" + clientExtensionApiJarVersion + ".jar";

			const clientExtensionMap : Map<string, string> = new Map<string, string>();

			clientExtensionMap.set('EXTENSION_METADATA_FILE',clientExtensionApiJarDownloaUrl);

			const extensionTypeString = extensionType.label;
			const commandExtensionType = extensionTypeString.charAt(0).toLowerCase() + extensionTypeString.slice(1)
			const options = {
				cwd: path.join(workspacePath,state.name),
				env: {
					'EXTENSION_METADATA_FILE' : clientExtensionApiJarDownloaUrl
				}
			  };

			const lxcExePath = `${lxcPath.replace(/\\/g, '/')}`;

			const result  = spawn (lxcExePath, ['generate','-i', state.name, '-n', state.extensionName, '-t', commandExtensionType, 'false' ], options); 
			// 监听子进程的标准输出和标准错误输出
			result.stdout.on('data', (data) => {
				console.log(`标准输出：${data}`);

				refreshWorkspaceView();

				window.showInformationMessage(`Creating Client Extension Project ${state.name}`);
			});
			
			result.stderr.on('data', (data) => {
				console.error(`标准错误输出：${data}`);
			});
			
			// 监听子进程的退出事件
			result.on('exit', (code, signal) => {
				if (code !== 0) {
					console.error(`命令执行出错，错误代码：${code}`);
				}
				if (signal) {
					console.error(`命令被信号中断，信号代码：${signal}`);
				}
			});
			
			// const result  = execFile(lxcExePath, ['generate','-i', state.name, '-n', state.extensionName, '-t', commandExtensionType, 'true' ], options ,(error, stdout, stderr) => {
			// 	if (error) {
			// 		console.error(`exec error: ${error}`);
			// 		return;
			// 	  }
			// 	  console.log(`stdout: ${stdout}`);
			// 	  console.log(`stderr: ${stderr}`);



			// });

			// exec(`${lxcExePath} generate -i ${state.name} -n ${state.extensionName} -t ${commandExtensionType} true`, options, (error, stdout, stderr) => {
			// 	if (error) {
			// 	  console.error(`exec error: ${error}`);
			// 	  return;
			// 	}
			// 	console.log(`stdout: ${stdout}`);
			// 	console.error(`stderr: ${stderr}`);
			//   });
		}

	}

	const state = await initLiferayClientExtension();

	lxcCreateClientExtensionProject();

	
}
