
export enum ProjectType {
    Default = "Default project",
    UnmanagedFolder = "Unmanaged folder",
    Maven = "Maven",
    Gradle = "Gradle",
    Others = "Others",
  }

export interface JavaRuntimeEntry {
  name: string;
  fspath: string;
  type: string;
  majorVersion: number;
}

export interface JdkData {
  os: string;
  arch: string;
  name: string;
  size: string;
  downloadLink: string;
}

export interface ProjectRuntimeEntry {
  name: string;
  rootPath: string;
  runtimePath: string;
  sourceLevel: string;
  projectType: ProjectType;
}
