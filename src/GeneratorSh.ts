import CompilationEnvironment, { GcnItem } from "./CompilationEnvironment"
import FileDependencies                    from "./FileDependencies"
import CompilationNode                     from "./CompilationNode"
import Generator                           from "./Generator"
import { ExecutorArgs }                    from "./Executor"
import * as path                           from 'path'
// import * as async                          from 'async'
// import * as which                          from 'which'
// import * as os                             from 'os'

export default
class GeneratorSh extends Generator {
    /** Here, CompilationNode arguments have an object { signature: string, name: string } as data */
    get_mission_node( for_found: FileDependencies, cb: ( cn: CompilationNode ) => void ): void {
        // shortcuts
        const args = this.env.args, cns = this.env.cns;
        if ( args.entry_point != undefined ) {
            const en = cns[ args.entry_point ].outputs[ 0 ];
            if ( path.extname( en ).toLowerCase() == ".sh" ) {
                // run
                if ( args.mission == "run" ) {
                    // arguments for "Executor"
                    // let ch = [ ...cns ], exe_args = [ 0 ] as Array<string|number>;
                    // for( const arg of ( args.arguments || [] ) as Array<string|CompilationNode> ) {
                    //     if ( arg instanceof CompilationNode ) {
                    //         exe_args.push( ch.length );
                    //         ch.push( arg );
                    //     } else
                    //         exe_args.push( arg );
                    // }

                    // launch
                    return cb( this.env.New( "Executor", cns, {
                        executable     : "sh",
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
