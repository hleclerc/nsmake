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
                const n_cwd = path.resolve( cwd, path.dirname( target ) );
                if ( filename[ 0 ] == '(' && filename.lastIndexOf( ')' ) > 0 )
                    return cb( this.env.New( "Codegen", [], { output, filename, cwd: n_cwd } ) );
            }
            return cb( null );
        } } );
    }
}
