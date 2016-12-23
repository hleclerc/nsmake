import Task               from "./Task"
import * as child_process from "child_process"
import * as path          from "path"

export
interface BaseCompilerInfoArgs {
    compiler: string; /** void for a systematic test */
    target  : string; /** c, cpp, ... */
}

export
class ExeDataBaseCompilerInfo {
    inc_paths = new Array<string>(); /** "system" include paths */
    defines   = "";                  /** "system" defines */
}

/** executable or items args number => num in children
 */
export default
class BaseCompilerInfo extends Task {
    exec( args: BaseCompilerInfoArgs ) {
        let exe_data = this.exe_data = new ExeDataBaseCompilerInfo;
        const cmp = path.basename( args.compiler );
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
                    exe_data.inc_paths.push( path.normalize( line.trim() ) );
            }

            // base defines
            let chd = child_process.spawnSync( cmp, [ `-x${ args.target == 'c' ? 'c' : 'c++' }`, '-dM', '-E', '-' ], {} );
            exe_data.defines = chd.stdout.toString( 'utf8' );
        } else
            throw new Error( `TODO: get base include paths for compiler '${ args.compiler }'` );
    }
}
