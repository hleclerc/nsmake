import CompilationEnvironment from "./CompilationEnvironment";
import CompilationNode        from "./CompilationNode";
import * as child_process     from 'child_process';

declare type StatusType = "idle" | "waiting" | "active";

/** */
export default
class Service {
    set_idle() {
        if ( this.status == "active" && this.cn )
            this.cn.pause_chrono();
        this.status = "idle";
    }

    set_waiting() {
        if ( this.status == "active" && this.cn )
            this.cn.pause_chrono();
        this.status = "waiting";
    }

    set_active() {
        if ( this.cn ) {
            if ( this.status == "idle" )
                this.cn.start_chrono();
            else if ( this.status == "waiting" )
                this.cn.resume_chrono();
        }
        this.status = "active";
    }

    status       = "idle" as StatusType;
    category     = null as string;                                /** if non null, name of the entry point for the service */
    send         : ( data: string ) => void; /** send answer to the child process */
    cp           = null as child_process.ChildProcess;
    env          = null as CompilationEnvironment;
    cn           = null as CompilationNode;
}
