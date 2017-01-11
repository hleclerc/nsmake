import CompilationEnvironment from "./CompilationEnvironment";
import CompilationNode        from "./CompilationNode";
import * as child_process     from 'child_process';

/** */
export default
class Service {
    status       = "idle" as "idle" | "waiting" | "active";
    category     = null as string;                           /** if non null, name of the entry point for the service */
    send         : ( data: string, use_stdin?: boolean ) => void; /** send answer to the child process. sync == true means using stdin */
    cp           = null as child_process.ChildProcess;
    env          = null as CompilationEnvironment;
    cn           = null as CompilationNode;
}
