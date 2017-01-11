import Task               from "./Task"
import * as child_process from "child_process"
import * as which         from "which"
import * as async         from "async"
import * as path          from "path"
import * as os            from "os"

export
interface BaseCompilerInfoArgs {
    compiler: string; /** null if compiler has to be found automatically */
    linker  : string; /** null if linker has to be found automatically */
    archiver: string; /** null if archiver has to be found automatically */

    target  : string; /** c, cpp, ... */
}

export
class ExeDataBaseCompilerInfo {
    inc_paths = new Array<string>(); /** "system" include paths */
    defines   = "";                  /** "system" defines */
    
    compiler  = "";                  /** g++, gcc, clang++, ... */
    linker    = "";                  /** g++, ld, ... */
    archiver  = "";                  /** ar, ... */
}

/** executable or items args number => num in children
 */
export default
class BaseCompilerInfo extends Task {
    //     assemblers = [ 'as', 'gas', 'nasm', 'masm']
    //     fortran_compilers = ['gfortran', 'g77', 'ifort', 'ifl', 'f95', 'f90', 'f77', 'fortran']

    exec( args: BaseCompilerInfoArgs, done: ( err: boolean ) => void ) {
        this.get_base_programs( args, ( compiler: string, linker: string, archiver: string ) => {
            if ( ! compiler || ! linker || ! archiver )
                return done( true );
            let exe_data = this.exe_data = new ExeDataBaseCompilerInfo;
            exe_data.compiler = compiler;
            exe_data.archiver = archiver
            exe_data.linker   = linker;

            // base include paths and defines
            const cmp = path.basename( compiler );
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
            } else {
                this.error( `TODO: get base include paths for compiler '${ compiler }'` );
                return done( true );
            }

            done( false );
        } );
    }

    get_base_programs( args: BaseCompilerInfoArgs, cb: ( compiler: string, linker: string, archiver: string ) => void ) {
        this.get_exe( args.target == "c" ? "cc" : "cxx", args.compiler, ( compiler ) => {
            const linker = args.linker || compiler;
            this.get_exe( "ar", args.archiver, ( archiver ) => {
                cb( compiler, linker, archiver );
            } );
        } );
    }

    /** name in [ "cxx", "cc", "ld", "ar", ... ] */
    get_exe( name: string, value: string, cb: ( res: string ) => void, download_allowed = true ): void {
        if ( value )
            return cb( value );
        // look in the system directories
        async.forEachSeries( this[ "_" + name + "_list" ](), ( comp: string, cb_test ) => {
            which( comp, ( err, path_name ) => cb_test( err ? null : path_name ) );
        }, ( path_name: string ) => {
            if ( ! path_name ) {
                // user did provide a compiler name
                if ( value ) {
                    if ( ! download_allowed ) {
                        this.error( `Installation of ${ value } did not produce the expected result (an executable)` );
                        return cb( null );
                    }
                    return this.check_prerequ( value, ( err, fail ) => {
                        fail ? cb( null ) : this.get_exe( name, value, cb, false );
                    } );
                }
                // else, try to install a default compiler
                if ( ! download_allowed ) {
                    this.error( `Installation of ${ name } did not produce the expected result (an executable)` );
                    return cb( null );
                }
                return this.check_prerequ( name, ( err, fail ) => {
                    fail ? cb( null ) : this.get_exe( name, value, cb, false ); // retry
                } );
            }
            cb( path_name );
        } );
    }

    /** */
    _cxx_list(): Array<string> {
        switch ( os.platform() ) {
            case "win32" : return [ 'msvc', 'intelc', 'icc', 'g++', 'clang++', 'c++', 'bcc32' ];
            case "sunos" : return [ 'sunc++', 'g++', 'clang++', 'c++'                         ];
            case "aix"   : return [ 'aixc++', 'g++', 'clang++', 'c++'                         ];
            case "darwin": return [ 'g++', 'clang++', 'c++'                                   ];
            default:       return [ 'g++', 'clang++', 'msvc', 'intelc', 'icc', 'c++'          ];
        }
    }

    /** */
    _cc_list(): Array<string> {
        switch ( os.platform() ) {
            case "win32" : return [ 'msvc', 'mingw', 'gcc', 'clang', 'intelc', 'icl', 'icc', 'cc', 'bcc32' ];
            case "sunos" : return [ 'suncc', 'gcc', 'clang', 'cc'                                          ];
            case "aix"   : return [ 'aixcc', 'gcc', 'clang', 'cc'                                          ];
            case "darwin": return [ 'gcc', 'clang', 'cc'                                                   ];
            default:       return [ 'gcc', 'clang', 'msvc', 'intelc', 'icc', 'cc'                          ];
        }
    }

    /** */
    _ld_list(): Array<string> {
        switch ( os.platform() ) {
            default:       return [ 'ld' ];
        }
    }

    /** */
    _ar_list(): Array<string> {
        switch ( os.platform() ) {
            case "win32" : return [ 'mslib', 'ar', 'llvm-ar' ];
            default:       return [ 'ar', 'llvm-ar'          ];
        }
    }
}
