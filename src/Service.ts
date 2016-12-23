import CompilationEnvironment from "./CompilationEnvironment";
import CompilationNode        from "./CompilationNode";
import * as child_process     from 'child_process';

/** */
export default class Service {
    want_restart = true;
    status       = "idle" as "idle" | "waiting" | "active";
    category     = null as string;                          /** if non null, name of the entry point for the service */
    send         : ( data: string ) => void;                /** function to send data to the child process */
    cp           = null as child_process.ChildProcess;
    env          = null as CompilationEnvironment;
    cn           = null as CompilationNode;
}