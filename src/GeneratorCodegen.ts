import { GcnItem }     from "./CompilationEnvironment";
import CompilationNode from "./CompilationNode";
import Generator       from "./Generator";
import * as path       from 'path';
import * as fs         from 'fs';

/**
 * Files like .../(foo xxx)xxx are considered as generated
 * 
 */
export default
class GeneratorCodegen extends Generator {
    get_gcn_funcs( funcs: Array<GcnItem> ) {
        funcs.push( { prio: 0, func: ( target: string, output: string, cwd: string, cb: ( cn: CompilationNode ) => void, for_found, care_about_target: boolean, allow_generation: boolean ): void => {
            if ( allow_generation ) {
                const filename = path.basename( target );
                if ( filename[ 0 ] == '(' && filename.lastIndexOf( ')' ) > 0 )
                    return cb( this.env.com.proc.pool.New( "Codegen", [], { output, filename, cwd } ) );
            }
            return cb( null );
        } } );
    }
}
