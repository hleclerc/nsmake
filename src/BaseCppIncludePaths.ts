import Task               from "./Task"
import * as child_process from "child_process"
import * as path          from "path"

/** positive of null number -> reference to children. negative number => - reference to new_build_files - 1 */
export
interface BaseCppIncludePathsArgs {
    compiler: string;
    target  : string; // c, cpp, ...
}

export
class ExeDataBaseCppIncludePaths {
    paths  = new Array<string>();
    defines: string;
}

/** executable or items args number => num in children
 */
export default
class BaseCppIncludePaths extends Task {
    exec( args: BaseCppIncludePathsArgs ) {
        let exe_data = this.exe_data = new ExeDataBaseCppIncludePaths, cmp = args.compiler;
        if ( cmp.startsWith( 'g++' ) || cmp.startsWith( 'gcc' ) || cmp.startsWith( 'clang' ) ) {
            // include paths
            let chp = child_process.spawnSync( cmp, [ `-x${ args.target == 'c' ? 'c' : 'c++' }`, '-v', '-E', '-' ], {} );
            let str = chp.stderr.toString( 'utf8' );
            let ibd = false;
            for( let line of str.split( '\n' ) ) {
                if ( line.startsWith( "#include <...>" ) )
                    ibd = true;
                else if ( line.startsWith( "End" ) )
                    break;
                else if ( ibd )
                    exe_data.paths.push( path.normalize( line.trim() ) );
            }

            // base defines
            let chd = child_process.spawnSync( cmp, [ `-x${ args.target == 'c' ? 'c' : 'c++' }`, '-dM', '-E', '-' ], {} );
            exe_data.defines = chd.stdout.toString( 'utf8' );
        } else
            throw new Error( `TODO: get base include paths for compiler '${ args.compiler }'` );
    }
}
