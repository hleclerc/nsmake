import JsLazySourceMap       from "./JsLazySourceMap"
import SourceMap, { coords } from "./SourceMap"
import Task                  from "./Task"
import * as bt               from "babel-types";
import * as babel            from "babel-core";
import * as yaml             from "js-yaml";
import * as path             from "path";
import * as fs               from "fs";
const js_tokens_matcher = require("js-tokens");

export
interface ArgsBabelTransformer {
    babel_env_arguments: string;
}

export
class ExeDataBabelTransformer {
    sourcemap = "";
    orig_name = ""; /** name of the "leaf" input javascript/typescript/Coffeescript/... (i.e. the source) */
}

/** 
 * Currently, this class is not used: babel transformations are made inside JsParser
 */
export default
class BabelTransformer extends Task {
    exec( args: ArgsBabelTransformer ) {
        const orig_name = this.children[ 0 ].exe_data.orig_name || this.children[ 0 ].outputs[ 0 ];

        // new exe_data, with first trivial arguments
        let exe_data = this.exe_data = new ExeDataBabelTransformer();
        exe_data.orig_name = orig_name;

        // // read file and sourcemap content for preprocessing. If sourcemap does not exist, we have to create one only if there are changes
        // const sm = new JsLazySourceMap( this.read_file_sync( this.children[ 0 ].outputs[ 0 ] ).toString(), this.children[ 0 ].outputs[ 0 ] );
        // const trans_list = new Array< { prog: string, args: string } >();
        // this.preprocessing( args, trans_list, exe_data, sm, orig_name );

        // // nsmake trans
        // for( let trans of trans_list ) {
        //     const src = this.get_filtered_target( trans.prog, path.dirname( orig_name ) ).name;
        //     const ins = require( src ).default;
        //     ins( this, sm );
        // }

        // // babel presets
        // let presets = new Array<any>();
        // if ( args.babel_env_arguments || args.target_browsers.length ) {
        //     let ea = args.babel_env_arguments ? yaml.load( "{" + args.babel_env_arguments + "}" ) : {};
        //     if ( args.target_browsers.length ) {
        //         if ( ! ea.targets )
        //             ea.targets = {};
        //         let lst = new Array<string>();
        //         for( let tb of args.target_browsers )
        //             lst.push( ...tb.split( "," ).map( x => x.trim() ) );
        //         ea.targets.browsers = lst;
        //     }
        //     presets.push( [ "env", ea ] );
        // }

        // if ( presets.length ) {
        //     var nout = babel.transform( sm.src_content, {
        //         ast       : false,
        //         code      : true,
        //         sourceMaps: true,
        //         presets,
        //     } );

        //     let nsm = new SourceMap( nout.code, '', JSON.stringify( nout.map ) );
        //     sm.apply( nsm );
        // }
        
        // // get requires, accept, ...
        // babel.transform( sm.src_content, {
        //     plugins   : [ parser( this, exe_data, args.js_env ) ],
        //     ast       : false,
        //     code      : false,
        //     sourceMaps: false,
        // } );

        // // save js and map files if necessary (if we had changes)
        // if ( sm.has_changes ) {
        //     const nsm = this.new_build_file( orig_name, ".js.map" );
        //     const njs = this.new_build_file( orig_name, ".js" );

        //     sm.append( `\n//# sourceMappingURL=${ path.relative( path.dirname( njs ), nsm ) }` );
        //     this.write_file_sync( nsm, sm.toString( njs ) );
        //     this.write_file_sync( njs, sm.src_content );
        //     exe_data.js_content_is_new = true;
        //     this.outputs = [ njs, nsm ];
        // } else {
        //     this.outputs = [ this.children[ 0 ].outputs[ 0 ] ];
        // }

        // // parse again the comments to find sourcemap indications
        // let beg = 0;
        // for( let token of sm.src_content.match( js_tokens_matcher ) ) {
        //     const sharp_sm_matcher = token.match( /^\/\/(# sourceMappingURL=)([^\n]+)/ );
        //     if ( sharp_sm_matcher ) {
        //         exe_data.pos_sharp_sourcemaps.push({ beg, mid: beg + sharp_sm_matcher[ 1 ].length, end: beg + sharp_sm_matcher[ 0 ].length });
        //         exe_data.sourcemap = path.resolve( path.dirname( this.outputs[ 0 ] ), sharp_sm_matcher[ 2 ] );
        //     }
        //     beg += token.length;
        // }
    }
}
