import LibRulesGenCompiler   from "./LibRulesGenCompiler"
import ExeDataGenCompiler    from "./ExeDataGenCompiler"
import { SystemInfo,
        is_compatible_with } from "./SystemInfo"
import { pu }                from "./ArrayUtil"
import { ExecutorArgs }      from "./Executor"
import Task                  from "./Task"
import * as path             from "path";
import * as fs               from "fs";

export
interface ArgsCppCompiler {
    define    : Array<string>;
    system    : SystemInfo;
    launch_dir: string;
    inc_paths : Array<string>;
    output    : string;
}

/** executable or items args number => num in children
 *  child 0 => sourcefile
 *  child 1 => concatened yaml rules
 *  child 2 => base include paths
 */
export default
class CppCompiler extends Task {
    exec( args: ArgsCppCompiler ) {
        // // store the aliases, find the new required files
        // this.register_aliases( res_cpp_parsers.reduce( ( p, x ) => p.concat( x.exe_data.aliases ), new Array< { key: string, val: string} >() ) );
        // this._find_requires_for( to_be_parsed, res_cpp_parsers );            
        // this._find_accepts_for( res_cpp_parsers );            

        // rules specified in .yaml files (nsmake/rules/cpp/*, ...), base_include_paths
        this.read_base_include_paths();
        this.read_rules();

        // const base_include_paths = this.children[ 2 ].exe_data.paths;
        const cpp_name = this.children[ 0 ].outputs[ 0 ];
        const orig_name = this.children[ 0 ].exe_data.orig_name || cpp_name;

        // new exe_data, with first trivial arguments
        let exe_data = this.exe_data = new ExeDataGenCompiler();
        exe_data.orig_name = orig_name;

        // read file and sourcemap content for preprocessing. If sourcemap does not exist, we have to create one only if there are changes
        const content = this.read_file_sync( cpp_name ).toString();
        const trans_list = new Array< { prog: string, args: string } >();
        this.preprocessing( args, trans_list, exe_data, content, orig_name );

        // nsmake trans
        for( let trans of trans_list ) {
            const src = this.get_filtered_target( trans.prog, path.dirname( orig_name ) ).name;
            const ins = require( src ).default;
            ins( this, content );
        }

        // name of the output file
        let new_build_files = [];
        let outputs = [];
        let o = null as string | number;
        if ( args.output ) {
            outputs.push( args.output );
            o = args.output;
        } else {
            new_build_files.push( { orig: orig_name, ext: ".o" } );
            outputs.push( -1 );
            o = -1;
        }

        // args
        let cmd_args = [ "-c", "-g3", "-std=c++11", "-Wall", "-o", o, cpp_name ];
        pu( cmd_args, ...this.inc_paths.map( n => "-I" + n ) );

        // command
        exe_data.command_sgn = this.make_signature( "Executor", [ this.signature ], {
            executable: "g++",
            args      : cmd_args,
            new_build_files,
            outputs,
        } as ExecutorArgs );

        this.outputs = [ cpp_name ];
    }

    /** read comments to find nsmake commands */
    preprocessing( args: ArgsCppCompiler, trans_list: Array<{ prog: string, args: string }>, exe_data: ExeDataGenCompiler, data: string, name: string ) {
        for( let b = 0, e = data.length; b < e; ) {
            // // variable
            // if ( beg_var( *b ) ) {
            //     const char *o = b;
            //     read_variable( 0, b, e, special_variables, [&]( unsigned leaf_val ) {
            //         if ( leaf_val )
            //             _variable( leaf_val, o, b, e, &read );
            //     }, false );
            //     ++read.num_inst;
            //     continue;
            // }

            // // number
            // if ( beg_num( *b ) ) {
            //     ++read.num_inst;
            //     // hexa
            //     if ( *b == '0' and b + 1 < e and ( b[ 1 ] == 'x' or b[ 1 ] == 'X' ) ) {
            //         ++b;
            //         while ( ++b < e and cnt_var( *b ) );
            //         continue;
            //     }
            //     // deci
            //     while ( ++b < e and beg_num( *b ) );
            //     if ( b < e and *b == '.' ) ++b;
            //     while ( b < e and beg_num( *b ) ) ++b;
            //     if ( b < e and ( *b == 'e' or *b == 'E' ) ) ++b;
            //     if ( b < e and *b == '-' ) ++b;
            //     while ( b < e and cnt_var( *b ) ) ++b;
            //     continue;
            // }

            // comment
            if ( data[ b ] == '/' ) {
                let o = b;
                if ( ++b < e ) {
                    if ( data[ b ] == '/' ) {
                        while ( ++b < e && data[ b ] != '\n' );
                        // this.note( `data.slice(o,b): ${ data.slice(o,b) }` );
                        continue;
                    }
                    if ( data[ b ] == "*" ) {
                        while ( ++b < e && ( data[ b - 1 ] != '*' || data[ b ] != '/' ) );
                        if ( b < e ) ++b;
                        continue;
                    }
                }
            }

            // string 1
            if ( data[ b ] == '"' ) {
                while ( ++b < e ) {
                    if ( data[ b ] == '\\' ) { if ( ++b >= e ) break; }
                    else if ( data[ b ] == '"' ) break;
                }
                if ( b < e ) ++b;
                continue;
            }

            // string 2
            if ( data[ b ] == "'" ) {
                while ( ++b < e ) {
                    if ( data[ b ] == "\\" ) { if ( ++b >= e ) break; }
                    else if ( data[ b ] == "'" ) break;
                }
                if ( b < e ) ++b;
                continue;
            }

            // preprocessing
            if ( data[ b ] == "#" ) {
                let o = b;
                let cnt_line = false;
                while ( ++b < e ) {
                    if ( data[ b ] == '\n' ) {
                        if ( ! cnt_line )
                            break;
                        cnt_line = false;
                    } else if ( data[ b ] == '\\' ) {
                        cnt_line = true;
                    } else if ( data[ b ] != ' ' && data[ b ] != '\t' )
                        cnt_line = false;
                }
                if ( this._cpp_preproc( args, trans_list, exe_data, data.slice( o, b ), name ) )
                    return;
                continue;
            }

            // something we don't care about
            ++b
        }
    }

    /** return true if reading has to stop */
    _cpp_preproc( args: ArgsCppCompiler, trans_list: Array<{ prog: string, args: string }>, exe_data: ExeDataGenCompiler, data: string, cur_name: string ): boolean {
        // include
        const include_match = data.match( /^#[ \t]*include[ \t]*(<)(.*)>/ ) || data.match( /^#[ \t]*include[ \t]*(")(.*)"/ );
        if ( include_match ) {
            this._include( args, trans_list, exe_data, cur_name, include_match[ 1 ], include_match[ 2 ] );
            return false;
        }

        // pragma once
        const pragma_once_match = data.match( /^#[ \t]*pragma[ \t]+once>/ );
        if ( pragma_once_match ) {
            if ( exe_data.includes.indexOf( cur_name ) >= 0 )
                return true;
        }

        return false;
    }
    
    _include( args: ArgsCppCompiler, trans_list: Array<{ prog: string, args: string }>, exe_data: ExeDataGenCompiler, cur_name: string, inc_type: string, inc_str: string ) {
        exe_data.include_strs.push( inc_str );

        // there's a registered rule for this library ?
        const rules = this.inc_rules.get( inc_str );
        if ( rules ) {
            const rule = this.for_system( args.system, rules.flag_sets )
            if ( rule ) {
                if ( rule.inc_paths ) pu( this    .inc_paths, ...rule.inc_paths.map( x => path.resolve( args.launch_dir, x ) ) );
                if ( rule.lib_paths ) pu( exe_data.lib_paths, ...rule.lib_paths.map( x => path.resolve( args.launch_dir, x ) ) );
                if ( rule.lib_names ) pu( exe_data.lib_names, ...rule.lib_names );
            }
        }

        // try to find the include
        const ext = inc_type == "<";
        const try_to_find = () => {
            let trials = [
                ...( ext ? [] : [ path.dirname( cur_name ) ] ),
                ...this.inc_paths,
                ...this.base_include_paths,
            ].map( x => path.resolve( x, inc_str ) );
            return this.get_first_filtered_target_signature( trials, path.dirname( cur_name ) );
        }
        let sgn = try_to_find();

        // not found ? => try to load it
        if ( ! sgn && rules ) {
            const rule = this.for_system( args.system, rules.load_sets )
            if ( rule && rule.command && this.run_install_cmd( "", args.launch_dir, rule.command, [] ) )
                throw '';
            // try again to find it
            sgn = try_to_find();
        }

        // if still not found, here we simply return (but there's an error in the non bootstrap version)
        if ( ! sgn ) {
            // if ( ! ext ) throw `Include ${ inc_str } not found`;
            return;
        }
        // if ( ext ) return; // for bootstrap, we don't care about external includes
        const name = this.get_cn_data( sgn.signature ).outputs[ 0 ];
        if ( this.loaded.has( name ) ) // ultra simplified load 
            return;
        this.loaded.add( name );
        exe_data.includes.push( name );
        this.preprocessing( args, trans_list, exe_data, this.read_file_sync( name ).toString(), name );
    }

    read_rules() {
        const data = JSON.parse( this.read_file_sync( this.children[ 1 ].outputs[ 0 ] ).toString() );
        for( const item of data ) {
            if ( ! item.data )
                continue;
            for( const include of item.data.includes || [] ) {
                if ( this.inc_rules.has( include ) )
                    this.error( `Rule for include <${ include }> appears twice in yaml rule files.` );
                item.data.yaml_name = item.name;
                this.inc_rules.set( include, item.data );
            }
        }
    }

    for_system<T extends { systems?: string[] }>( system: SystemInfo, set: Array<T> ): T {
        for( const val of set )
            if ( is_compatible_with( system, val.systems ) )
                return val;
        return null;
    }

    read_base_include_paths() {
        this.base_include_paths = this.children[ 2 ].exe_data.paths;
    }

    base_include_paths = new Array<string>();
    inc_rules          = new Map<string,LibRulesGenCompiler>(); /** include => rules */
    inc_paths          = new Array<string>();
    lib_paths          = new Array<string>();
    lib_names          = new Array<string>();

    loaded             = new Set<string>(); ///< include loaded
}
