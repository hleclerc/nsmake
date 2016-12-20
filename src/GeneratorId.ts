import { GcnItem }      from "./CompilationEnvironment";
import FileDependencies from "./FileDependencies";
import CompilationNode  from "./CompilationNode";
import Generator        from "./Generator";
import * as path        from 'path';
import * as fs          from 'fs';

/** if the target exists in the filesystem, return it (low priority) */
export default
class GeneratorId extends Generator {
    get_gcn_funcs( funcs: Array<GcnItem> ) {
        funcs.push( { prio: -1, func: ( target: string, output: string, cwd: string, cb: ( cn: CompilationNode ) => void, for_found: FileDependencies ): void => {
            fs.exists( target, exists => {
                if ( exists ) {
                    cb( this.env.com.proc.pool.New( "Id", [], { target } ) );
                } else {
                    for_found.failed.add( target );
                    cb( null );
                }
            } );
        } } );
    }
}
