import CompilationEnvironment, { GcnItem } from "./CompilationEnvironment";
import FileDependencies                    from "./FileDependencies";
import CompilationNode                     from "./CompilationNode";
import ArgumentParser                      from "./ArgumentParser";

export default
class Generator {
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
    
    env: CompilationEnvironment;
}
