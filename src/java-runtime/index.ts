/* eslint-disable @typescript-eslint/naming-convention */
import * as _ from "lodash";
import { JavaRuntimeEntry, ProjectRuntimeEntry, ProjectType } from "./types";
import * as fse from "fs-extra";
import { findRuntimes, getRuntime, getSources, IJavaRuntime, JAVAC_FILENAME, JAVA_FILENAME } from 'jdk-utils';
import * as path from "path";
import * as vscode from "vscode";
import { env, workspace } from 'vscode';
import Constants from "../constants";


let javaHomes: IJavaRuntime[];
//export const REQUIRED_JDK_VERSION = 17;
const expandHomeDir = require("expand-home-dir");

export async function findJavaRuntimeEntries(): Promise<{
    javaRuntimes?: JavaRuntimeEntry[],
    projectRuntimes?: ProjectRuntimeEntry[],
    javaDotHome?: string;
    javaHomeError?: string;
  }> {
    if (!javaHomes) {
      const runtimes: IJavaRuntime[] = await findRuntimes({ checkJavac: true, withVersion: true, withTags: true});
      javaHomes = runtimes.filter(r => r.hasJavac); 
    }

    const javaRuntimes: JavaRuntimeEntry[] = javaHomes.map(elem => ({
      name: elem.homedir,
      fspath: elem.homedir,
      majorVersion: elem.version?.major || 0,
      type: "from jdk-utils"
    })).sort((a, b) => b.majorVersion - a.majorVersion);
  
    let javaDotHome;
    let javaHomeError;
    try {
      const runtime = await resolveRequirements();
      javaDotHome = runtime.tooling_jre;
      const javaVersion = runtime.tooling_jre_version;
      if (!javaVersion || javaVersion < Constants.REQUIRED_JDK_VERSION) {
        javaHomeError = `Java ${Constants.REQUIRED_JDK_VERSION} or more recent is required by the Java language support (redhat.java) extension. Preferred JDK "${javaDotHome}" (version ${javaVersion}) doesn't meet the requirement. Please specify or install a recent JDK.`;
      }
    } catch (error) {
      javaHomeError = (error as Error).message;
    }
  
    let projectRuntimes = await getProjectRuntimesFromPM();
    if (_.isEmpty(projectRuntimes)) {
      projectRuntimes = await getProjectRuntimesFromLS();
    }
  
    return {
      javaRuntimes,
      projectRuntimes,
      javaDotHome,
      javaHomeError
    };
  }
  
  async function getProjectRuntimesFromPM(): Promise<ProjectRuntimeEntry[]> {
    const ret: ProjectRuntimeEntry[] = [];
    const projectManagerExt = vscode.extensions.getExtension("vscjava.vscode-java-dependency");
    if (vscode.workspace.workspaceFolders && projectManagerExt && projectManagerExt.isActive) {
      let projects: any[] = [];
      for (const wf of vscode.workspace.workspaceFolders) {
        try {
          projects = await vscode.commands.executeCommand("java.execute.workspaceCommand", "java.project.list", wf.uri.toString()) || [];
        } catch (error) {
          console.error(error);
        }
  
        for (const project of projects) {
          const runtimeSpec = await getRuntimeSpec(project.uri);
          const projectType: ProjectType = await getProjectType(vscode.Uri.parse(project.uri).fsPath);
          ret.push({
            name: project.displayName || project.name,
            rootPath: project.uri,
            projectType,
            ...runtimeSpec
          });
        }
      }
    }
    return ret;
  }
  
  async function getProjectRuntimesFromLS(): Promise<ProjectRuntimeEntry[]> {
    const ret: ProjectRuntimeEntry[] = [];
    const javaExt = vscode.extensions.getExtension("redhat.java");
    if (javaExt && javaExt.isActive) {
      let projects: string[] = [];
      try {
        projects = await vscode.commands.executeCommand("java.execute.workspaceCommand", "java.project.getAll") || [];
      } catch (error) {
        // LS not ready
      }
  
      for (const projectRoot of projects) {
        const runtimeSpec = await getRuntimeSpec(projectRoot);
        const projectType: ProjectType = await getProjectType(vscode.Uri.parse(projectRoot).fsPath);
        ret.push({
          name: getProjectNameFromUri(projectRoot),
          rootPath: projectRoot,
          projectType: projectType,
          ...runtimeSpec
        });
      }
    }
    return ret;
  }

  export async function getProjectType(fsPath: string): Promise<ProjectType> {
    if (isDefaultProject(fsPath)) {
        return ProjectType.Default;
    }
    const buildDotGradleFile = path.join(fsPath, "build.gradle");
    if (await fse.pathExists(buildDotGradleFile)) {
      return ProjectType.Gradle;
    }
    const pomDotXmlFile = path.join(fsPath, "pom.xml");
    if (await fse.pathExists(pomDotXmlFile)) {
      return ProjectType.Maven;
    }
    const dotProjectFile = path.join(fsPath, ".project");
    if (!await fse.pathExists(dotProjectFile)) { // for invisible projects, .project file is located in workspace storage.
      return ProjectType.UnmanagedFolder;
    }
    return ProjectType.Others;
}

export function isDefaultProject(path: string): boolean {
    return path.indexOf("jdt.ls-java-project") > -1;
}

export function getProjectNameFromUri(uri: string): string {
  return path.basename(vscode.Uri.parse(uri).fsPath);
}
  
  async function getRuntimeSpec(projectRootUri: string) {
    let runtimePath;
    let sourceLevel;
    const javaExt = vscode.extensions.getExtension("redhat.java");
    if (javaExt && javaExt.isActive) {
      const SOURCE_LEVEL_KEY = "org.eclipse.jdt.core.compiler.source";
      const VM_INSTALL_PATH = "org.eclipse.jdt.ls.core.vm.location";
      try {
        const settings: any = await javaExt.exports.getProjectSettings(projectRootUri, [SOURCE_LEVEL_KEY, VM_INSTALL_PATH]);
        runtimePath = settings[VM_INSTALL_PATH];
        sourceLevel = settings[SOURCE_LEVEL_KEY];
      } catch (error) {
        console.warn(error);
      }
    }
  
    return {
      runtimePath,
      sourceLevel
    };
  }

  async function getMajorVersion(javaHome?: string): Promise<number> {
    if (!javaHome) {
        return 0;
    }
    const runtime = await getRuntime(javaHome, { withVersion: true });
    return runtime?.version?.major || 0;
}

function invalidJavaHome(reject: any, reason: string) {
    reject(new Error(reason));
}


function checkJavaPreferences(){
    let preference: string = 'java.jdt.ls.java.home';
    let javaHome = workspace.getConfiguration().get<string>('java.jdt.ls.java.home');
    if (!javaHome) { // Read java.home from the deprecated "java.home" setting.
        preference = 'java.home';
        javaHome = workspace.getConfiguration().get<string>('java.home');
    }
    return {
        javaHome,
		preference
	};
}

/**
 * Sort by major version in descend order.
 */
function sortJdksByVersion(jdks: IJavaRuntime[]) {
    jdks.sort((a, b) => (b.version?.major ?? 0) - (a.version?.major ?? 0));
}

function sortJdksBySource(jdks: IJavaRuntime[]) {
    const rankedJdks = jdks as Array<IJavaRuntime & { rank: number }>;
    const sources = ["JDK_HOME", "JAVA_HOME", "PATH"];
    for (const [index, source] of sources.entries()) {
        for (const jdk of rankedJdks) {
            if (jdk.rank === undefined && getSources(jdk).includes(source)) {
                jdk.rank = index;
            }
        }
    }
    rankedJdks.filter(jdk => jdk.rank === undefined).forEach(jdk => jdk.rank = sources.length);
    rankedJdks.sort((a, b) => a.rank - b.rank);
}

async function findDefaultRuntimeFromSettings(): Promise<string | undefined> {
    const runtimes = workspace.getConfiguration().get("java.configuration.runtimes");
    if (Array.isArray(runtimes) && runtimes.length) {
        let candidate: string | undefined;
        for (const runtime of runtimes) {
            if (!runtime || typeof runtime !== 'object' || !runtime.path) {
                continue;
            }

            const jr = await getRuntime(runtime.path);
            if (jr) {
                candidate = jr.homedir;
            }

            if (runtime.default) {
                break;
            }
        }

        return candidate;
    }

    return undefined;
}

export async function resolveRequirements(): Promise<{
    tooling_jre: string | undefined;  // Used to launch Java extension.
    tooling_jre_version: number;
    java_home: string | undefined; // Used as default project JDK.
    java_version: number;
}> {
    const javaExtPath: string | undefined = vscode.extensions.getExtension("redhat.java")?.extensionPath;
    let toolingJre: string | undefined = await findEmbeddedJRE(javaExtPath);
    let toolingJreVersion: number = await getMajorVersion(toolingJre);
    return new Promise(async (resolve, reject) => {
        let source: string;
        const javaPreferences = checkJavaPreferences();
        let preferenceName = javaPreferences.preference;
        let javaVersion: number = 0;
        let javaHome = javaPreferences.javaHome;
        if (javaHome) { // java.jdt.ls.java.home or java.home setting has highest priority.
            source = `java.home variable defined in ${env.appName} settings`;
            javaHome = expandHomeDir(javaHome);
            if (!await fse.pathExists(javaHome!)) {
                invalidJavaHome(reject, `The ${source} points to a missing or inaccessible folder (${javaHome})`);
            } else if (!await fse.pathExists(path.resolve(javaHome!, 'bin', JAVAC_FILENAME))) {
                let msg: string;
                if (await fse.pathExists(path.resolve(javaHome!, JAVAC_FILENAME))) {
                    msg = `'bin' should be removed from the ${source} (${javaHome})`;
                } else {
                    msg = `The ${source} (${javaHome}) does not point to a JDK.`;
                }
                invalidJavaHome(reject, msg);
            }
            javaVersion = await getMajorVersion(javaHome);
            if (preferenceName === "java.jdt.ls.java.home" || !toolingJre) {
                toolingJre = javaHome;
                toolingJreVersion = javaVersion;
            }
        }

        // java.home not specified, search valid JDKs from env.JAVA_HOME, env.PATH, SDKMAN, jEnv, jabba, Common directories
        const javaRuntimes = await findRuntimes({checkJavac: true, withVersion: true, withTags: true});
        if (!toolingJre) { // universal version
            // as latest version as possible.
            sortJdksByVersion(javaRuntimes);
            const validJdks = javaRuntimes.filter(r => r.version && r.version.major >= Constants.REQUIRED_JDK_VERSION);
            if (validJdks.length > 0) {
                sortJdksBySource(validJdks);
                javaHome = validJdks[0].homedir;
                javaVersion = validJdks[0].version?.major ?? 0;
                toolingJre = javaHome;
                toolingJreVersion = javaVersion;
            }
        } else { // pick a default project JDK/JRE
            /**
             * For legacy users, we implicitly following the order below to
             * set a default project JDK during initialization:
             * java.home > env.JDK_HOME > env.JAVA_HOME > env.PATH
             *
             * We'll keep it for compatibility.
             */
            if (javaHome && (await getRuntime(javaHome) !== undefined)) {
                const runtime = await getRuntime(javaHome, {withVersion: true});
                if (runtime) {
                    javaHome = runtime.homedir;
                    javaVersion = runtime.version?.major ?? 0;
                }
            } else if (javaRuntimes.length) {
                sortJdksBySource(javaRuntimes);
                javaHome = javaRuntimes[0].homedir;
                javaVersion = javaRuntimes[0].version?.major ?? 0;
            } else if (javaHome = (await findDefaultRuntimeFromSettings() ?? "")) {
                javaVersion = await getMajorVersion(javaHome);
            } else {
                /**
                 * Originally it was:
                 * invalidJavaHome(reject, "Please download and install a JDK to compile your project. You can configure your projects with different JDKs by the setting ['java.configuration.runtimes'](https://github.com/redhat-developer/vscode-java/wiki/JDK-Requirements#java.configuration.runtimes)");
                 * 
                 * here we focus on tooling jre, so we swallow the error.
                 * 
                 */
            }
        }
        

        if (!toolingJre || toolingJreVersion < Constants.REQUIRED_JDK_VERSION) {
            // For universal version, we still require users to install a qualified JDK to run Java extension.
            invalidJavaHome(reject, `Java ${Constants.REQUIRED_JDK_VERSION} or more recent is required to run the Java extension. Please download and install a recent JDK. You can still compile your projects with older JDKs by configuring ['java.configuration.runtimes'](https://github.com/redhat-developer/vscode-java/wiki/JDK-Requirements#java.configuration.runtimes)`);
        }

        resolve({
            tooling_jre: toolingJre,  // Used to launch Java extension.
            tooling_jre_version: toolingJreVersion,
            java_home: javaHome, // Used as default project JDK.
            java_version: javaVersion,
        });
    });
}

async function findEmbeddedJRE(javaExtPath?: string): Promise<string | undefined> {
    if (!javaExtPath) {
        return undefined;
    }
    const jreHome = path.join(javaExtPath, "jre");
    if (fse.existsSync(jreHome) && fse.statSync(jreHome).isDirectory()) {
        const candidates = fse.readdirSync(jreHome);
        for (const candidate of candidates) {
            if (fse.existsSync(path.join(jreHome, candidate, "bin", JAVA_FILENAME))) {
                return path.join(jreHome, candidate);
            }
        }
    }

    return;
}