import Task from "./Task"

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export interface ExecutorArgs {
    executable       : string | number;                      
    args             : Array<string | number>;
    local_execution ?: boolean;
    redirect        ?: string | number;
    outputs         ?: Array<string | number>;               /** outputs of the task */
    new_build_files ?: Array<{ orig: string, ext: string }>; /** build files to be created. */
    pure_function   ?: boolean;                              /** true by default */
}

/** executable or items args number => num in children
 */
export default
class Executor extends Task {
    exec( args: ExecutorArgs ) {
        // build files
        let build_files = new Array<string>();
        for( let abf of args.new_build_files || [] )
            build_files.push( this.new_build_file( abf.orig, abf.ext ) );

        // helper to get arg values
        const av = ( n: string | number ): string => {
            if ( typeof n == 'string' ) return n;
            return n >= 0 ? this.children[ n ].outputs[ 0 ] : build_files[ - n - 1 ];
        };

        // do it
        this.spawn_sync( av( args.executable ), args.args.map( av ), args.local_execution || false, av( args.redirect || '' ) );
        this.pure_function = args.pure_function != undefined ? args.pure_function : true;
        this.outputs = ( args.outputs || [] ).map( av );
    }

}
