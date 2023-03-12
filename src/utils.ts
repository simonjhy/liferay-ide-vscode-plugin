'use strict';

import * as fs from 'fs';
import { PathLike } from 'fs';
import * as path from 'path';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { promisify } from 'util';
import { exec } from 'child_process';
import fetch, { Response } from 'node-fetch';
import * as vscode from 'vscode';
import * as os from 'os';
import { JavaRuntime } from './java-runtime/findJavaHomes';


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