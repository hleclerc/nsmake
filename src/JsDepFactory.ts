import { fill_sm_with_js_tokens } from "./JsLazySourceMap"
import SourceMap, { SmItem }      from "./SourceMap"
import { pu }                     from "./ArrayUtil"
import { ExeDataJsParser, ArgsJsParser,  
         Require, Accept, Pss  }  from "./JsParser"
import Task                       from "./Task"
import * as babel                 from 'babel-core'
import * as path                  from 'path'

interface ResJsParser {
    signature     : string;            /** signature of JsParser(...) */
    outputs       : Array<string>;
    exe_data      : ExeDataJsParser;
    // added by JsDepFactory
    orig_signature: string;             /** signature of the parsed file */
    parents       : Array<ResJsParser>;
    need_rewrite  : boolean;
    content       : string;             /** content used in JsParser */
    sourcemap     : SourceMap;          /** */
    mtime         : number;             /** modification date of the used output */
}

export
interface ArgsJsDepFactory {
    js_env             : string;
    pos_js_header      : number;        /** pos of JsHeader in children */
    output             : Array<string>;
    mission            : string;
    sm_line            : string;
    dist_dir           : string;
    cwd                : string;
    concat             : boolean;
    min                : boolean;
    hot_replacement    : string;
    define             : Array<string>; /** NAME(args...)=val or NAME for macros without arguments */
    ext_libs           : Array<string>; /**  */
    babel_env_arguments: string;
    target_browsers    : Array<string>;
}

// stuff that has to be modified in js files
interface E_Require { type: "Require"; pos: number; data: Require; }
interface E_Accept  { type: "Accept";  pos: number; data: Accept;  }
interface E_Pss     { type: "Pss";     pos: number; data: Pss;     }
declare type E_stuff = E_Require | E_Accept | E_Pss;


/**
 */
export default
class JsDepFactory extends Task {
    exec( args: ArgsJsDepFactory ) {
        // find html and js name using args.output, args.mission, ... 
        this._get_output_names( args.output, args.mission );

        // parse the js files to find all the requires + nsmake cmds
        let to_be_parsed = new Array<string>( this.children[ 0 ].signature );
        if ( args.pos_js_header >= 0 )
            to_be_parsed.push( this.children[ args.pos_js_header ].signature );
        for( let num_to_be_parsed = 0; num_to_be_parsed < to_be_parsed.length; ) {
            // parse required file in parallel
            const lst = to_be_parsed.slice( num_to_be_parsed ).map( sgn => this.make_signature( "JsParser", [ sgn ], {
                js_env             : args.js_env,
                define             : args.define,
                babel_env_arguments: args.babel_env_arguments,
                target_browsers    : args.target_browsers,
            } as ArgsJsParser ) );
            const res_js_parsers = this.get_cns_data( lst ) as Array<ResJsParser>;
            num_to_be_parsed = to_be_parsed.length;
            
            // store the aliases, find the new required files
            this.register_aliases( res_js_parsers.reduce( ( p, x ) => p.concat( x.exe_data.aliases ), new Array< { key: string, val: string} >() ) );
            this._find_requires_for( args, to_be_parsed, res_js_parsers );            
            this._find_accepts_for( args, res_js_parsers );            

            // store the parsing result
            for( let num_item = 0; num_item < res_js_parsers.length; ++num_item ) {
                const orig_signature = to_be_parsed[ num_to_be_parsed - lst.length + num_item ];
                this.js_parsers.set( orig_signature, res_js_parsers[ num_item ] );
                res_js_parsers[ num_item ].orig_signature = orig_signature;
            }
        }
        this.ep_js_parser = this.js_parsers.get( to_be_parsed[ 0 ] );

        //
        this._want_concat( args ) ?
           this._make_concat( args ) :
           this._make_sep( args );
    }

    /** try to set _js_name and _html_name */
    _get_output_names( outputs: Array<string>, mission: string ): void {
        // look in output extensions
        let output = outputs.filter( x => {
            if ( mission == "html" && [ ".html", ".htm" ].indexOf( path.extname( x ).toLowerCase() ) >= 0 ) {
                this._html_name = x;
                return false;
            }
            if ( [ ".js", ".jsx" ].indexOf( path.extname( x ).toLowerCase() ) >= 0 ) {
                this._js_name = x;
                return false;
            }
            return true;
        } );
        // else, use outputs as a sequence
        if ( mission == "html" && ! this._html_name && outputs.length )
            this._html_name = outputs.shift();
        if ( ! this._js_name && outputs.length )
            this._js_name = outputs.shift();
    }

    /** set this.requires, update to_be_parsed if a new source appears */
    _find_requires_for( args: ArgsJsDepFactory, to_be_parsed: Array<string>, js_parsers: Array<ResJsParser> ): void {
        // if we have some requires
        if ( js_parsers.some( jp => jp.exe_data.requires.length != 0 ) ) { 
            let lst_trials = new Array<{cwd:string,requires:Array<string>}>();
            for( const js_parser of js_parsers )
                lst_trials.push({ cwd: path.dirname( js_parser.exe_data.orig_name ), requires: js_parser.exe_data.requires.map( req => req.txt ) });
            const res = this.get_requires( lst_trials, args.js_env );

            // if we haven't found all the files
            if ( res.some( x => x.some( v => ! v ) ) ) {
                let error = false;
                for( let num_js_parser = 0; num_js_parser < js_parsers.length; ++num_js_parser ) {
                    for( let num_require = 0; num_require < js_parsers[ num_js_parser ].exe_data.requires.length; ++num_require ) {
                        // it it's a node module, remove the require
                        if ( res[ num_js_parser ][ num_require ] == null ) {
                            js_parsers[ num_js_parser ].exe_data.requires.splice( num_require, 1 );
                            res[ num_js_parser ].splice( num_require, 1 );
                            --num_require;
                        } else if ( res[ num_js_parser ][ num_require ] == "" ) {
                            this.error( `Error:${ js_parsers[ num_js_parser ].exe_data.orig_name }: cannot find module '${ js_parsers[ num_js_parser ].exe_data.requires[ num_require ].txt }'` );
                            error = true;
                        }
                    }
                }
                if ( error )
                    throw '';
            }

            for( let num_js_parser = 0; num_js_parser < res.length; ++num_js_parser ) {
                for( let num_require = 0; num_require < res[ num_js_parser ].length; ++num_require ) {
                    const sgn = res[ num_js_parser ][ num_require ];
                    this.requires.set( js_parsers[ num_js_parser ].exe_data.requires[ num_require ], sgn );
                    if ( to_be_parsed.indexOf( sgn ) < 0 )
                        to_be_parsed.push( sgn );
                }
            }
        }
    }

    /** set this.requires, update to_be_parsed if a new source appears */
    _find_accepts_for( args: ArgsJsDepFactory, js_parsers: Array<ResJsParser> ): void {
        // if we have some accepts to find
        if ( js_parsers.some( jp => jp.exe_data.accepts.length != 0 ) ) { 
            let lst_trials = new Array<{cwd:string,requires:Array<string>}>();
            for( const js_parser of js_parsers )
                lst_trials.push({ cwd: path.dirname( js_parser.exe_data.orig_name ), requires: js_parser.exe_data.accepts.map( req => req.txt ) });
            const res = this.get_requires( lst_trials, args.js_env );

            // if we haven't found all the files
            if ( res.some( x => x.some( v => ! v ) ) ) {
                for( let num_js_parser = 0; num_js_parser < js_parsers.length; ++num_js_parser )
                    for( let num_accept = 0; num_accept < js_parsers[ num_js_parser ].exe_data.accepts.length; ++num_accept )
                        if ( ! res[ num_js_parser ][ num_accept ] )
                            this.error( `Error:${ js_parsers[ num_js_parser ].exe_data.orig_name }: cannot find module '${ js_parsers[ num_js_parser ].exe_data.accepts[ num_accept ].txt }'` );
                throw '';
            }

            for( let num_js_parser = 0; num_js_parser < res.length; ++num_js_parser ) {
                for( let num_accept = 0; num_accept < res[ num_js_parser ].length; ++num_accept ) {
                    const sgn = res[ num_js_parser ][ num_accept ];
                    this.accepts.set( js_parsers[ num_js_parser ].exe_data.accepts[ num_accept ], sgn );
                }
            }
        }
    }

    /** return true if input and required files should be concatened */
    _want_concat( args: ArgsJsDepFactory ): boolean {
        return args.concat || args.min || [ "html", "min", "concat" ].indexOf( args.mission ) >= 0;
    }

    /** Concatenate js content */
    _make_concat( args: ArgsJsDepFactory ) {
        //
        if ( ! this._js_name )
            this._js_name = this.new_build_file( this.ep_js_parser.exe_data.orig_name, ".js", args.dist_dir );
        else
            this.generated.push( this._js_name );
        this.outputs = [ this._js_name ];

        const map_name = this._js_name + ".map";
        this.generated.push( map_name );

        const manifest_name = this._js_name + ".manifest";
        this.generated.push( manifest_name );

        // load the content (sources and sourcemaps), set sourcemap, update change directory of output if necessary, store mtime
        for( let js of this.js_parsers.values() ) {
            js.content = this.read_file_sync( js.outputs[ 0 ] ).toString();
            js.sourcemap = js.exe_data.sourcemap ?
                new SourceMap( js.content, path.dirname( js.exe_data.sourcemap ), this.read_file_sync( js.exe_data.sourcemap ).toString() ) : 
                this._make_sourcemap_from_js_content( js.content, js.outputs[ 0 ] );

            // if hot_replacement and outputs is not in dist, copy the file to have it in the expected directory
            if ( args.hot_replacement && ! path.normalize( js.outputs[ 0 ] ).startsWith( args.dist_dir ) ) {
                js.outputs[ 0 ] = this.new_build_file( js.outputs[ 0 ], ".js", args.dist_dir );
                this.write_file_sync( js.outputs[ 0 ], js.content );
            }

            js.mtime = this.stat( js.outputs[ 0 ] ).mtime.getTime();
        }

        // how a js parser is reference in the js file
        function escaped( str: string ) {
            const chars = [ "#", ":", ",", "[", "]", "'", '"', '\\' ];
            let res = "";
            for( let c of str )
                res += chars.indexOf( c ) >= 0 ? chars[ 0 ] + chars.indexOf( c ).toString() : c;
            return res;
        }
        function synthetic_json( d: any ): string {
            if ( typeof d == "number" ) return d.toString();
            if ( typeof d == "string" ) return escaped( d );
            if ( d instanceof Array ) return `[${ d.map( x => synthetic_json( x ) ).join( "," ) }]`;
            return Object.keys( d ).map( key => synthetic_json( key ) + ":" + synthetic_json( d[ key ] ) ).join( "," );
        }
        function synthetic_repr( d: Array<any> ): string {
            return `${ d[ 0 ] }[${ [ ...d[ 1 ].map( synthetic_repr ), synthetic_json( d[ 2 ] ) ].join( "," ) }]`;
        }
        const id_map = ( x: ResJsParser ): string => {
            const d = JSON.parse( x.orig_signature );
            const s = d[ 0 ] == "Id" ? escaped( d[ 2 ].target ) : "#_" + synthetic_repr( d );
            return s.split( args.cwd + path.sep ).join( "" );
        };

        // read and substitution of variables in js_header
        if ( args.pos_js_header < 0 )
            throw `Nsmake internal error: we were expecting a js_header child`;
        let hr_js_parser = this.js_parsers.get( this.children[ args.pos_js_header ].signature ), sm = hr_js_parser.sourcemap;
        hr_js_parser.exe_data.pos_sharp_sourcemaps.reverse().forEach( pos => sm.replace( pos.beg, pos.end, "" ) );
        repl_sm( sm, /'SOURCE-MAP-SUPPORT'.*\n/m, args.js_env.startsWith( "nodejs" ) ? this._sm_line( args, path.dirname( this._js_name ), path.dirname( this.ep_js_parser.exe_data.orig_name ) ) + "\n" : "" );
        repl_sm( sm, /'VAR PROCESS'.*\n/m       , args.js_env.startsWith( "nodejs" ) ? "" : `var process={env:{NODE_ENV:'${ process.env.NODE_ENV ? process.env.NODE_ENV : "" }'}};\n` );
        repl_sm( sm, /'ID_MAIN_MODULE'/         , JSON.stringify( id_map( this.ep_js_parser ) ) );
        const rem = resi_sm( sm, /.*BEG_MODULE_DATA.*\n/m );

        // hot module reload
        if ( args.hot_replacement ) {
            repl_sm( sm, /[^{]*BUILD_IDS[^}]*/, [ ...this.js_parsers.values() ].map( js => `${ JSON.stringify( id_map( js ) ) }:${ js.mtime }` ).join( ',' ) );
            repl_sm( sm, /'URL_MANIFEST'/     , JSON.stringify( this.rel_with_dot( path.dirname( this._js_name ), manifest_name ) ) );
        }

        // append the files
        for( let js of this.js_parsers.values() ) {
            if ( js == hr_js_parser )
                continue;
            
            // modified requires, accepts and pss (reversed chronological order)
            for( let ms of this._modifiable_stuff( js ) ) {
                switch ( ms.type ) {
                    case "Require":
                        js.sourcemap.replace( ms.data.bin, ms.data.ein, `__nsmake_require__(${ JSON.stringify( id_map( this.js_parsers.get( this.requires.get( ms.data ) ) ) ) })` );
                        break;
                    case "Accept":
                        js.sourcemap.replace( ms.data.bqu, ms.data.equ, JSON.stringify( id_map( this.js_parsers.get( this.accepts.get( ms.data ) ) ) ) );
                        break;
                    case "Pss":
                        js.sourcemap.remove( ms.data.beg, ms.data.end );
                        break;
                }
            }

            //
            sm.append( `// ============================================================\n${ JSON.stringify( id_map( js ) ) }:function(module,exports,__nsmake_require__){\n` );
            sm.append( js.sourcemap );
            sm.append( js.sourcemap.src_content[ js.sourcemap.src_content.length - 1 ] == "\n" ? `},\n` : `\n},\n` );
        }

        // closing
        sm.append( rem );

        // minification
        if ( args.min ) {
            this.note( `sm.src_content: ${ sm.src_content }` );
            var nout = babel.transform( sm.src_content, {
                ast       : false,
                code      : true,
                sourceMaps: true,
                presets   : [ "babili" ],
                comments  : false,
            } );
            let nsm = new SourceMap( nout.code, '', JSON.stringify( nout.map ) );
            sm.apply( nsm );
        }

        // sourcemap info
        sm.append( `\n//# sourceMappingURL=${ path.relative( path.dirname( this._js_name ), map_name ) }\n` );
       

        // manifest data
        let manifest = {
            ep: id_map( this.ep_js_parser ),
            md: {} as any,
        };
        for( let js of this.js_parsers.values() ) {
            manifest.md[ id_map( js ) ] = {
                build_id: js.mtime,
                url     : this.rel_with_dot( path.dirname( this._js_name ), js.outputs[ 0 ] ),
                requires: js.exe_data.requires.map( req => { return {
                    b: req.bin,
                    e: req.ein,
                    t: `__nsmake_require__('${ id_map( this.js_parsers.get( this.requires.get( req ) ) ) }')`
                } } ),
                accepts: js.exe_data.accepts.map( req => { return {
                    b: req.bqu,
                    e: req.equ,
                    t: "'" + id_map( this.js_parsers.get( this.accepts.get( req ) ) ) + "'"
                } } )
            };
        }
         
        // write result
        this.note( `Emission of '${ this._js_name }' (+ .manifest and .map)` );
        this.write_file_sync( this._js_name, sm.src_content );
        this.write_file_sync( map_name, sm.toString( this._js_name ) );
        this.write_file_sync( manifest_name, JSON.stringify( manifest ) );

        //
        if ( args.mission == 'html' )
            this._make_html( args );
    }

    _make_html( args: ArgsJsDepFactory ) {
        if ( ! this._html_name )
            this._html_name = this.new_build_file( this.ep_js_parser.exe_data.orig_name, ".html", args.dist_dir );
        else
            this.generated.push( this._html_name );
        this.outputs.unshift( this._html_name );

        // default html template
        let html_template = `<html>\n<head>\n  <meta charset='utf-8'>\n</head>\n<body>\n$HTML_CONTENT$SCRIPTS\n</body>\n</html>\n`;

        // there's a nsmake html_template ?
        for( let js of this.js_parsers.values() ) {
            const ht = js.exe_data.html_template;
            if ( ht ) {
                const wd = path.dirname( js.exe_data.orig_name );
                const fn = this.get_filtered_target( path.resolve( wd, ht ), wd ).name;
                html_template = this.read_file_sync( fn ).toString();
                break;
            }
        }

        // preparation for the SCRIPTS line (ext_libs + entry point)
        let ext_libs = new Array<string>();
        for( let js_parser of this.js_parsers.values() )
            for( let ext_lib of js_parser.exe_data.ext_libs )
                pu( ext_libs, ext_lib.split( " " )[ 1 ] );
        for( let ext_lib of args.ext_libs )
            pu( ext_libs, ext_lib.split( " " )[ 1 ] );

        let scripts = '';
        for( let ext_lib of ext_libs )
            scripts += `  <script type='text/javascript' src='${ ext_lib }' charset='utf-8'></script>\n`;
        scripts += `  <script type='text/javascript' src='${ this.rel_with_dot( path.dirname( this._html_name ), this._js_name ) }' charset='utf-8'></script>`;

        // substitutions
        const new_data = html_template.
            replace( "$HTML_CONTENT", [ ...this.js_parsers.values() ].map( x => x.exe_data.html_content.map( x => x + "\n" ) ).reduce( ( x, y ) => x.concat( y ) ).join( "" ) ).
            replace( "$SCRIPTS"     , scripts );

        // output
        this.note( `Emission of '${ this._html_name }'` );
        this.write_file_sync( this._html_name, new_data );
    }

    /** */
    _make_sourcemap_from_js_content( content: string, filename: string ): SourceMap {
        let res = new SourceMap( content, null, { sources: [ filename ] }, false );
        fill_sm_with_js_tokens( res );
        return res;
    }

    /** */
    _make_sep( args: ArgsJsDepFactory ) {
        // set up parents (needed to set up need_rewrite)
        for( let jp of this.js_parsers.values() )
            jp.parents = new Array<ResJsParser>();
        for( let jp of this.js_parsers.values() )
            for( let req of jp.exe_data.requires )
                this.js_parsers.get( this.requires.get( req ) ).parents.push( jp );

        // helper for need_rewrites
        function set_need_rewrite_rec( jp: ResJsParser ) {
            if ( jp.need_rewrite )
                return;
            jp.need_rewrite = true;
            for( let pa of jp.parents )
                set_need_rewrite_rec( pa );
        }

        // set need_rewrite
        for( let jp of this.js_parsers.values() )
            jp.need_rewrite = false;
        if ( this._js_name )
            this.ep_js_parser.need_rewrite = true;

        let need_rewrite = false, hr_js_parser = args.pos_js_header >= 0 ? this.js_parsers.get( this.children[ args.pos_js_header ].signature ) : null;
        for( let js of this.js_parsers.values() ) {
            if ( js.need_rewrite || js == hr_js_parser )
                continue;
            // if a js file has been rewritten, the parents have also to be rewritten (because the requires will be different)
            const another_dir_and_requires = path.dirname( js.outputs[ 0 ] ) != path.dirname( js.exe_data.orig_name ) && js.exe_data.requires.length;
            if ( another_dir_and_requires || js.exe_data.js_content_is_new || ( js == this.ep_js_parser && this._js_name && js.outputs[ 0 ] != this._js_name ) ) {
                // if the file has been rewritten elsewhere and there are requires, the content will have to me modified also by `this`
                if ( another_dir_and_requires ) {
                    js.need_rewrite = true;
                    need_rewrite = true;
                }

                // `js.outputs[ 0 ]` is different of `js.exe_data.orig_name` => parents will have to modify their requires  
                for( let pa of js.parents ) {
                    set_need_rewrite_rec( js );
                    need_rewrite = true;
                }
            }
        }

        // modify files needing rewrite
        if ( need_rewrite ) {
            // load the files needing rewrite, get new output names
            for( let js of this.js_parsers.values() ) {
                if ( js.need_rewrite ) {
                    js.content = this.read_file_sync( js.outputs[ 0 ] ).toString();
                    js.sourcemap = js.exe_data.sourcemap ?
                        new SourceMap( js.content, path.dirname( js.exe_data.sourcemap ), this.read_file_sync( js.exe_data.sourcemap ).toString() ) : 
                        this._make_sourcemap_from_js_content( js.content, js.outputs[ 0 ] );

                    const njs = js == this.ep_js_parser && this._js_name ? this._js_name : this.new_build_file( js.exe_data.orig_name, ".js" );
                    const nsm = njs + ".map"; // this.new_build_file( js.exe_data.orig_name, ".js.map" );
                    this.generated.push( nsm );
                    js.outputs = [ njs, nsm ];
                }
            }            
            
            // update requires and accepts, write the files
            for( let js of this.js_parsers.values() ) {
                if ( js.need_rewrite ) {
                    // modified requires, accepts and pss (reversed chronological order)
                    for( let ms of this._modifiable_stuff( js ) ) {
                        switch ( ms.type ) {
                            case "Require": {
                                const tjs = this.js_parsers.get( this.requires.get( ms.data ) ).outputs[ 0 ];
                                js.sourcemap.replace( ms.data.bqu, ms.data.equ, JSON.stringify( this.rel_with_dot( path.dirname( js.outputs[ 0 ] ), tjs ) ) );
                                break;
                            }
                            case "Accept": {
                                const tjs = this.js_parsers.get( this.accepts.get( ms.data ) ).outputs[ 0 ];
                                js.sourcemap.replace( ms.data.bqu, ms.data.equ, JSON.stringify( this.rel_with_dot( path.dirname( js.outputs[ 0 ] ), tjs ) ) );
                                break;
                            }
                            case "Pss":
                                js.sourcemap.remove( ms.data.beg, ms.data.end );
                                break;
                        }
                    }

                    // write the result
                    js.sourcemap.append( `\n//# sourceMappingURL=${ path.relative( path.dirname( js.outputs[ 0 ] ), js.outputs[ 1 ] ) }` );
                    this.write_file_sync( js.outputs[ 1 ], js.sourcemap.toString( js.outputs[ 0 ] ) );
                    this.write_file_sync( js.outputs[ 0 ], js.sourcemap.src_content );
                }
            }
        }

        // if no need for rewrite, we can use the original file
        this.outputs = [ this.ep_js_parser.outputs[ 0 ] ];
    }

    _modifiable_stuff( js: ResJsParser ): Array<E_stuff> {
        let lst = [
            ...js.exe_data.requires            .map( x => ( { type: "Require", data: x, pos: x.bqu } as E_Require ) ),
            ...js.exe_data.accepts             .map( x => ( { type: "Accept" , data: x, pos: x.bqu } as E_Accept  ) ),
            ...js.exe_data.pos_sharp_sourcemaps.map( x => ( { type: "Pss"    , data: x, pos: x.beg } as E_Pss     ) ),
        ];
        lst.sort( ( a, b ) => b.pos - a.pos );
        return lst;
    }

    _find_node_module_directory( cur_dir: string, module_name: string ): string {
        for( ; cur_dir.length > 1; cur_dir = path.dirname( cur_dir ) ) {
            let tn = path.resolve( cur_dir, 'node_modules', module_name );
            if ( this.is_directory( tn ) )
                return tn;
        }
        return null;
    }

    _sm_line( args: ArgsJsDepFactory, target_dir: string, orig_js_dir: string ) {
        const sms_dir = this._find_node_module_directory( orig_js_dir, 'source-map-support' );
        return sms_dir ? args.sm_line.replace( 'source-map-support', this.rel_with_dot( target_dir, sms_dir ) ) : args.sm_line;
    }


    js_parsers   = new Map<string,ResJsParser>();  /** signature => res of JsParser */ 
    requires     = new Map<Require,string>();      /** require => signature */
    accepts      = new Map<Accept,string>();       /** require => signature */
    ep_js_parser : ResJsParser;                    /** JsParser of entry point */
    _js_name     : string;
    _html_name   : string;
}

/** replace in sourcemap first instance of expr by value */
function repl_sm( sourcemap: SourceMap, expr: RegExp, value: string ): void {
    let m = sourcemap.src_content.match( expr );
    if ( m ) {
        sourcemap.replace( m.index, m.index + m[ 0 ].length, value );
        repl_sm( sourcemap, expr, value );
    }
}

/** resize sourcemap to end at first instance of expr */
function resi_sm( sourcemap: SourceMap, expr: RegExp ): string {
    let m = sourcemap.src_content.match( expr ), r = sourcemap.src_content.substr( m.index + m[ 0 ].length );
    sourcemap.replace( m.index, sourcemap.src_content.length, "" );
    return r;
}

/** remove content between beg of beg_expr and end of end_expr */
function remo_sm( sourcemap: SourceMap, beg_expr: RegExp, end_expr: RegExp ): void {
    let b = sourcemap.src_content.match( beg_expr );
    let e = sourcemap.src_content.match( end_expr );
    sourcemap.replace( b.index, e.index + e[ 0 ].length, "" );
}
