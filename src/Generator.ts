import CompilationEnvironment, { GcnItem } from "./CompilationEnvironment";
import FileDependencies                    from "./FileDependencies";
import CompilationNode                     from "./CompilationNode";
import ArgumentParser                      from "./ArgumentParser";
import Service                             from "./Service";

export default
class Generator {
    static src = ""; /** source file */
    
    constructor( env: CompilationEnvironment ) {
        this.env = env;
    }

    /** */
    decl_additional_options( p: ArgumentParser ) {
    }

    /** */
    get_gcn_funcs( funcs: Array<GcnItem> ) {
    }
    
    /**  */
    get_mission_node( for_found: FileDependencies, cb: ( cn: CompilationNode ) => void ) {
        return cb( null );
    }

    /** */
    msg_from_service( service: Service, action: string, args: any, ans: ( err: boolean, res: any ) => void, err_msg: ( msg: string ) => void ) {
        err_msg( `Service ${ this.constructor.name } does not have a 'msg_from_service' method (for action ${ action } or not). Service is going to be killed` );
        service.cp.kill();
    }

    /** */
    launch_stuff_to_be_re_executed( cn: CompilationNode ) {
    }
    
    env : CompilationEnvironment;
}
