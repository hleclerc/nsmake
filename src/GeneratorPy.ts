import CompilationEnvironment, { GcnItem } from "./CompilationEnvironment"
import FileDependencies                    from "./FileDependencies"
import CompilationNode                     from "./CompilationNode"
import Generator                           from "./Generator"
import { ExecutorArgs }                    from "./Executor"
import * as path                           from 'path'

export default
class GeneratorPy extends Generator {
    /** Here, CompilationNode arguments have an object { signature: string, name: string } as data */
    get_mission_node( for_found: FileDependencies, cb: ( cn: CompilationNode ) => void ): void {
        // shortcuts
        const args = this.env.args, cns = this.env.cns;
        if ( args.entry_point != undefined ) {
            const en = cns[ args.entry_point ].outputs[ 0 ];
            if ( path.extname( en ).toLowerCase() == ".py" ) {
                // run
                if ( args.mission == "run" ) {
                    // launch
                    return cb( this.env.New( "Executor", cns, {
                        executable     : "python",
                        args           : [ args.entry_point, ...( args.arguments || [] ) ],
                        local_execution: args.local_execution == undefined ? true: args.local_execution,
                        outputs        : args.redirect ? [ args.redirect ] : [],
                        redirect       : args.redirect || '',
                        new_build_files: args.new_build_files || [],
                        idempotent     : args.idempotent || false,
                    } as ExecutorArgs ) );
                }
            }
        }


        return cb( null );
    }
}
