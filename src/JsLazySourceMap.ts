import SourceMap, { SmItem } from "./SourceMap"
import * as path             from "path";
const css_tokens_matcher = require( "css-tokens" );
const js_tokens_matcher  = require( "js-tokens" );

/**
 * 
 */
export
function fill_sm_with_token_matcher( sm: SourceMap, num_in_sources: number, token_matcher ) {
    if ( ! sm.src_content )
        return;
    //const tokens = sm.src_content.match( js_tokens_matcher );
    let gc = 0, ol = 0, items = new Array<SmItem>(), regex = js_tokens_matcher, match;

    regex.lastIndex = 0;
    while ( match = regex.exec( sm.src_content ) ) {
        const token = regex.matchToToken( match );
        
        // append stuff we care about
        if ( token.type != "whitespace" )
            items.push( { gc, of: num_in_sources, ol, oc: gc, on: token.type == "name" ? sm.namenum( token.value ) : -1 } );
        gc += token.value.length;

        // new line
        const ind_n = token.value.lastIndexOf( "\n" );
        if ( ind_n >= 0 ) {
            for( let i = token.value.split( "" ).filter( x => x == "\n" ).length; i--; ) { 
                sm.lines.push( items );
                ++ol;
            }
            gc = token.value.length - ind_n - 1;
            items = new Array<SmItem>();
            continue;
        }
    }
    sm.lines.push( items );
}

/** fill sourcemap items with token of `content` */
export
function fill_sm_with_js_tokens( sm: SourceMap, num_in_sources = 0 ) {
    fill_sm_with_token_matcher( sm, num_in_sources, js_tokens_matcher );
}

/** fill sourcemap items with token of `content` */
export
function fill_sm_with_css_tokens( sm: SourceMap, num_in_sources = 0 ) {
    fill_sm_with_token_matcher( sm, num_in_sources, css_tokens_matcher );
}

/**
 * Interface around SourceMap to create sourcemap data only if there are changes or if the data are explicitely required
 */
export default
class JsLazySourceMap {
    constructor( src_content: string, filename: string ) {
        this.sm = new SourceMap( src_content, null, { sources: [ filename ] }, false );
    }

    get src_content(): string {
        return this.sm.src_content;
    }

    replace( beg: number, end: number, str: string | SourceMap ): void {
        if ( end != beg || ( typeof str == "string" ? str.length : str.src_content.length ) )
            this._set_has_changes();
        this.sm.replace( beg, end, str );
    }

    remove( beg: number, end: number ): void {
        this.replace( beg, end, "" );
    }

    append( that: SourceMap | string ): void {
        if ( typeof that == "string" ? that.length : that.src_content.length )
            this._set_has_changes();
        this.sm.append( that );
    }

    apply( that: SourceMap ): void {
        if ( that.src_content != this.src_content )
            this._set_has_changes();
        this.sm.apply( that );
    }

    find_item( line: number, col: number ): SmItem {
        return this.sm.find_item( line, col );
    }

    toString( js_file: string, dir = path.dirname( js_file ) ): string {
        return this.sm.toString( js_file, dir );
    }

    _set_has_changes(): void {
        if ( this.has_changes )
            return;
        this.has_changes = true;
        fill_sm_with_js_tokens( this.sm );
    }

    sm          : SourceMap;
    filename    : string;
    has_changes = false;     /** */
}
