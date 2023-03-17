'use strict';

import * as fs from 'fs';
import { PathLike } from 'fs';
import * as path from 'path';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { promisify } from 'util';
import { exec, spawnSync } from 'child_process';
import fetch, { Response } from 'node-fetch';
import * as vscode from 'vscode';
import * as os from 'os';
import { findJavaHomes, JavaRuntime } from './java-runtime/findJavaHomes';
import Constants from './constants';
import * as crypto from 'crypto';
import { Hash } from 'crypto';
import * as util from "util";
import { ExtensionApi as GradleApi, RunTaskOpts, Output } from "vscode-gradle";
import * as xpath from 'xpath';
import * as xmldom from 'xmldom';
import { SelectedValue } from 'xpath';
import * as xmlParser from 'xml-js';
import * as jsonpath from 'jsonpath';


	function findParentElements(json: any, selector: string): any[] {
		// 使用 jsonpath.query 方法查找所有符合条件的元素
		const elements = jsonpath.query(json, selector);

		// 返回所有符合条件的元素的父元素
		return elements.map((element: any) => {
			return element.parent;
		});
	}

	export function findTagsWithCssSelector(filePath: string, cssSelector: string):  any[] {
		const xml = fs.readFileSync(filePath, 'utf8');

		// 将 XML 解析为 JSON 对象
		const json = xmlParser.xml2json(xml, { compact: true });

		// 从 JSON 中查找所有符合条件的元素的父元素
		const artifactId = 'com.liferay.client.extension.type.api';
		const parentElements = findParentElements(json, `dependency > artifactId[text="${artifactId}"]`);

		console.log(parentElements); // 输出所有符合条件的父元素		
		return parentElements;
  	}

	  export function findTagsWithXpath(filePath: string, xpathTag: string): SelectedValue[] {
		// 读取 XML 文件
		const xml = fs.readFileSync(filePath, 'utf8');

		// 将 XML 解析为 DOM 对象
		const doc = new xmldom.DOMParser().parseFromString(xml);

		// 使用 XPath 获取指定元素
		const clientExtensionApiJarVersionElement = xpath.select(xpathTag,doc);

		// for (const element of clientExtensionApiJarVersionElement) {
		// 	// 获取子元素的值
		// 	const value = xpath.select('string(../version)', element);
		  
		// 	console.log(`artifactId: ${element.textContent}, version: ${value}`);
		// }

		console.log("clientExtensionApiJarVersionElement size is " + clientExtensionApiJarVersionElement.length);

		return clientExtensionApiJarVersionElement;
  	}

	export function getJavaConfiguration(): WorkspaceConfiguration {
		return workspace.getConfiguration('java');
	}

	export function getLiferayConfiguration(): WorkspaceConfiguration {
		return workspace.getConfiguration('liferay');
	}

	export interface ProductInfo{

		appServerTomcatVersion: string;
		bundleUrl: string;
		liferayDockerImage: string;
		liferayProductVersion: string;
		promoted: boolean;
		releaseDate: Date;
		bundleChecksumMD5: string;
		bundleChecksumMD5Url: string;
		targetPlatformVersion: string;

	}

	export function deleteDirectory(dir : PathLike) {
		if (fs.existsSync(dir)) {
			fs.readdirSync(dir).forEach((child) => {
				const entry = path.join(dir.toLocaleString(), child);
				if (fs.lstatSync(entry).isDirectory()) {
					deleteDirectory(entry);
				} else {
					fs.unlinkSync(entry);
				}
			});
			fs.rmdirSync(dir);
		}
	}

	export function getTimestamp(file: PathLike) {
		if (!fs.existsSync(file)) {
			return -1;
		}
		const stat = fs.statSync(file);
		return stat.mtimeMs;
	}

	export function ensureExists(folder: PathLike) {
		if (fs.existsSync(folder)) {
			return;
		}
		ensureExists(path.dirname(folder.toLocaleString()));
		fs.mkdirSync(folder);
	}

	export async function callJarFileAsync(): Promise<void> {
		const execAsync = promisify(exec);

		const args = ['arg1', 'arg2', 'arg3'];
		try {
		const { stdout, stderr } = await execAsync(`java -jar myjarfile.jar ${args.join(' ')}`);
		console.log('stdout:', stdout);
		console.error('stderr:', stderr);
		} catch (err) {
		console.error(err);
		}
	}

	export async function downloadFile(url: string, cacheDirName: string, fileName: string): Promise<string> {
		const cacheDir = path.join(os.homedir(), cacheDirName);	
		const cacheDirExists = fs.existsSync(cacheDir);

		if (!cacheDirExists) {
			fs.mkdir(cacheDir, { recursive: true }, (err) => {
				if (err) {
					throw new Error(`Failed to create blade cache directory ${cacheDir}.`);
				}
				console.log(`Directory ${cacheDir} created successfully`);
			});		
		}
	
		const savePath = path.join(cacheDir, fileName);

		// Check if the file already exists
		const fileExists = fs.existsSync(savePath);
		if (fileExists) {
		const stats = fs.statSync(savePath);
		const fileModifiedTime = stats.mtimeMs;
		// Check if the file needs to be updated
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to download file from ${url}.`);
		}
		const remoteModifiedTime = new Date(response.headers.get('last-modified')!).getTime();
		if (remoteModifiedTime <= fileModifiedTime) {
			return savePath;
		}
		}
	
		const response = await fetch(url);
		if (!response.ok) {
		throw new Error(`Failed to download file from ${url}.`);
		}
	
		const fileStream = fs.createWriteStream(savePath);

		if (response.body === undefined || response.body === null) {
			throw new Error('Response body is empty');
		}

		response.body.pipe(fileStream);
	
		return new Promise<string>((resolve, reject) => {
		fileStream.on('finish', () => resolve(savePath));
		fileStream.on('error', reject);
		});
	}
	

	export function getJavaExecutable(javaHome: JavaRuntime): string{
		if (process.platform === 'win32') {
			return path.join(javaHome.home, '/bin/java.exe');
		} else if ((process.platform === 'darwin') || (process.platform === 'linux')) {
			return path.join(javaHome.home, '/bin/java');
		}

		return 'underfined';
	}

	function openWorkspaceFolder(workspacePath: string){
		const uri = vscode.Uri.file(workspacePath);
		const workspaceFolder = vscode.workspace.updateWorkspaceFolders(0, 0, { uri });
		vscode.workspace.getWorkspaceFolder(uri);
		vscode.commands.executeCommand('vscode.openFolder', uri, false);
	}

	export async function openCurrentLiferayWorkspaceProject(workspacePath: string): Promise<void> {
		const folderPath = vscode.workspace.workspaceFolders || (vscode.window.activeTextEditor && path.dirname(vscode.window.activeTextEditor.document.uri.fsPath));
		if (!folderPath) {
		vscode.window.showErrorMessage('Can not open the workspace project');
		return;
		}
		const folderUri = vscode.Uri.file(workspacePath);
	
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
		openWorkspaceFolder(workspacePath);
		} else {
			const confirmResult = await vscode.window.showWarningMessage(`Do you want to close current workspace folder and open ${folderUri} as a new workspace folder?`, 'Yes', 'No');
			if (confirmResult === 'Yes') {
				let currentWorkspaceFolders = vscode.workspace.workspaceFolders;

				if (currentWorkspaceFolders === undefined ){
					return;
				}
				else{
					const currentWorkspaceFolder = currentWorkspaceFolders[0];
					vscode.workspace.updateWorkspaceFolders(currentWorkspaceFolder.index, 1,);
					vscode.commands.executeCommand('workbench.action.closeFolder');
				}
			} else {
				return;
			}

			openWorkspaceFolder(workspacePath);
		}
	}


	export async function addFolderToWorkspace(folderPath: string): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders) {
			const folderUri = vscode.Uri.file(folderPath);
			vscode.workspace.updateWorkspaceFolders(workspaceFolders.length, 0, { uri: folderUri });
		}
	}

	export async function refreshWorkspaceView(): Promise<void> {
		vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
	}


	export function findDirectoriesContaining(dir: string, filterDir: string): string[] {
		let results: string[] = [];
	
		const files = fs.readdirSync(dir);
	
		files.forEach((file) => {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
	
		if (stat.isDirectory()) {
			const dirName = path.basename(filePath);
			if (dirName.includes(filterDir)) {
			results.push(filePath);
			} else {
			results = results.concat(findDirectoriesContaining(filePath,filterDir ));
			}
		}
		});
	
		return results;
	}
	

	export interface WorkspaceFolderMatch {
		folder: vscode.WorkspaceFolder;
		match: boolean;
	}
  
	export function findMatchingWorkspaceFolder(pattern: string): WorkspaceFolderMatch | undefined {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
		return undefined;
		}
		for (const folder of workspaceFolders) {
		const folderPath = folder.uri.fsPath;
		const folderName = folderPath.slice(folderPath.lastIndexOf('/') + 1);
		if (folderName === pattern) {
			return { folder, match: true };
		}
		}
		return { folder: workspaceFolders[0], match: false };
	}

	export function getCurrentWorkspacePath(): string | undefined {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return undefined;
		}
		const workspaceFolder = workspaceFolders[0];
		return workspaceFolder.uri.fsPath;
	}

	export async function getProductInfos(): Promise<Map<string, ProductInfo>> {
		const productInfoPath = await downloadFile(Constants.PRODUCT_INFO_DOWNLOAD_URL, Constants.PRODUCT_INFO_CACHE_DIR, Constants.PRODUCT_INFO_NAME);

		const jsonString = fs.readFileSync(productInfoPath, 'utf-8');

		const productInfoMap = new Map<string, ProductInfo>();

		const jsonObject = JSON.parse(jsonString);

		for (const key in jsonObject) {
			if (Object.prototype.hasOwnProperty.call(jsonObject, key)) {
			const productInfo = jsonObject[key] as ProductInfo;
			productInfoMap.set(key, productInfo);
			}
		}

		return productInfoMap;
	}

	export async function getBladeJar(): Promise<string> {
		return downloadFile(Constants.BLADE_DOWNLOAD_URL, Constants.BLADE_CACHE_DIR, Constants.BALDE_JAR_NAME);
	}

