import { GcnItem }     from "./CompilationEnvironment";
import CompilationNode from "./CompilationNode"
import ArgumentParser  from "./ArgumentParser"
import Generator       from "./Generator"
import * as path       from 'path'
import * as fs         from 'fs'

/**
 * Files like .../(foo xxx)xxx are considered as generated
 * 
 */
export default
class GeneratorMission extends Generator {
    get_gcn_funcs( funcs: Array<GcnItem> ) {
        funcs.push( { prio: 0, func: ( target: string, output: string, cwd: string, cb: ( cn: CompilationNode ) => void, for_found, care_about_target: boolean, allow_generation: boolean ): void => {
            const match = path.basename( target ).match( /mission:(.*)\[(.*)\]$/ );
            if ( match ) {
                // find mission
                const key = match[ 1 ], ind = match[ 2 ], val = this.env.mission_keys.get( key );
                if ( ! val ) {
                    this.env.com.error( null, `Mission key '${ key }' has not been registered` );
                    return cb( null );
                }

                // interpret val
                var p = new ArgumentParser( "internal_nsmake_interpreter", 'an hopefully less dummy build system', '0.0.1' );
                this.env.decl_additional_options( p );
                let args = {} as any, targets = new Array<string>();
                p.parse_args( args, targets, val.split( " " ), path.dirname( target ) );

                // task to make targets, launch mission and get the wanted output
                return cb( this.env.New( "MissionOutput", [], { args, targets, ind, cwd: path.dirname( target ) } ) );
            }
            return cb( null );
        } } );
    }
}
