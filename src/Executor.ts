import { pu }     from "./ArrayUtil"
import Task       from "./Task"
import * as async from "async"

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export interface ExecutorArgs {
    executable       : string | number;                      
    exec_with        : string;
    args             : Array<string | number>;                                                /** positive number => look in children. negative number => look in build files */
    local_execution ?: boolean;
    use_lib_paths   ?: boolean;
    redirect        ?: string | number;
    outputs         ?: Array<string | number>;                                                /** outputs of the task */
    new_build_files ?: Array<{ orig?: string, ext?: string, dist?: string, value?: string }>; /** build files to be created. */
    idempotent      ?: boolean;                                                               /** true by default */
    orig_env        ?: object;                                                                /**  */
}

/** executable or items args number => num in children
 */
export default
class Executor extends Task {
    exec( args: ExecutorArgs, done: ( err: boolean ) => void ) {
        // build files
        async.map( args.new_build_files || [], ( abf, cb_nbf ) => {
            this.new_build_file( abf.orig || "", abf.ext || "", abf.dist || "", cb_nbf, abf.value || "" );
        }, ( err, build_files: Array<string> ) => {
            // helper to get arg values
            const av = ( n: string | number ): string => {
                if ( typeof n == 'string' ) return n;
                return n >= 0 ? this.children[ n ].outputs[ 0 ] : build_files[ - n - 1 ];
            };

            // environment
            let env = args.orig_env || {};
            if ( args.use_lib_paths ) {
                var lib_paths = [];
                var exe_paths = [];
                for( const ch of this.children )  {
                    if ( ch.exe_data ) {
                        if ( ch.exe_data.lib_paths )
                            pu( lib_paths, ...ch.exe_data.lib_paths );
                        if ( ch.exe_data.exe_paths )
                            pu( exe_paths, ...ch.exe_data.exe_paths );
                    }
                }
                if ( lib_paths.length )
                    env["LD_LIBRARY_PATH"] = lib_paths.join( ":" ) + ( args.orig_env["LD_LIBRARY_PATH"] ? ":" + args.orig_env["LD_LIBRARY_PATH"] : "" );
                if ( exe_paths.length )
                    env["PATH"] = exe_paths.join( ":" ) + ( args.orig_env["PATH"] ? ":" + args.orig_env["PATH"] : "" );
            }

            // launch
            let la = [ av( args.executable ), ...args.args.map( av ) ];
            if ( args.exec_with )
                la = [ ...args.exec_with.split( " " ), ...la ];
                
            this.spawn( la[ 0 ], la.slice( 1 ), ( err, code ) => {
                this.idempotent = args.idempotent != undefined ? args.idempotent : true;
                this.outputs = ( args.outputs || [] ).map( av );
                done( Boolean( err || code ) );
            }, args.local_execution || false, av( args.redirect || '' ), env ); // 
        } );
    }
}
