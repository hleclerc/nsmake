import Vlq       from "./Vlq";
import * as path from "path";


export
class SmItem {
    gc: number; ///< generated col (absolute)
    of: number; ///< original file (absolute)
    ol: number; ///< original line (absolute)
    oc: number; ///< original col  (absolute)
    on: number; ///< original name (absolute). -1 if no name
}

type Coords = {
    l: number,
    c: number
}

export
function coords( str: string, pos: number ) : Coords {
    let nc = 0, nl = 0;
    for( let ind = 0; ind < pos; ++ind ) {
        if ( str[ ind ] == "\n" ) {
            nc = 0;
            ++nl;
        } else
            ++nc;
    }
    return { l: nl, c: nc };
}

function nb_lines_and_cols( str: string ) : Coords {
    return coords( str, str.length ); // str.forEach for something more optimized
}

function nb_cols_at_end( str: string ) : number {
    for( let i = str.length; i--; )
        if ( str[ i ] == "\n" )
            return str.length - 1 - i;
    return str.length;
}

export default
class SourceMap {
    /** */
    constructor( src_content = '', dir = null as string, sourcemap_data? : string | { sources:string[], names?:string[], mappings?:string }, completion = true ) {
        this._init( src_content, dir, typeof sourcemap_data == 'string' ? JSON.parse( sourcemap_data ) : sourcemap_data, completion );
    }

    _init( src_content: string, dir: string, sourcemap_data : { sources:string[], names?:string[], mappings:string }, completion ) {
        this.src_content = src_content;

        //
        if ( sourcemap_data ) {
            // names
            if ( sourcemap_data.names ) {
                this.names = [ ...sourcemap_data.names ];
                for( let i = 0; i < this.names.length; ++i )
                    this.map_names.set( this.names[ i ], i );
            }

            // sources
            if ( sourcemap_data.sources )
                for( let source of sourcemap_data.sources )
                    this.sources.push( path.normalize( path.resolve( dir, source ) ) );

            // lines
            if ( sourcemap_data.mappings ) {
                let _of = 0, _ol = 0, _oc = 0, _on = 0;
                for( const line of sourcemap_data.mappings.split( ";" ) ) {
                    let items = new Array<SmItem>(), _gc = 0;
                    for( const item of line.split( "," ) ) {
                        if ( item.length ) {
                            let decoder = Vlq.decoder( item );
                            items.push( {
                                gc: _gc += decoder.read(),
                                of: _of += decoder.read(),
                                ol: _ol += decoder.read(),
                                oc: _oc += decoder.read(),
                                on: decoder.eof() ? -1 : ( _on += decoder.read() ),
                            } )
                        }
                    }
                    this.lines.push( items );
                }
            }
        }

        // completion of lines
        if ( completion )
            for( let n = this.src_content.split( "\n" ).length; this.lines.length < n; )
                this.lines.push( [] );
    }

    toString( js_file: string, dir = path.dirname( js_file ) ) {        
        let _of = 0, _ol = 0, _oc = 0, _on = 0;
        const mappings = this.lines.map( x => {
            let _gc = 0;
            return x.map( item => {
                let res = "";
                res += Vlq.encode( item.gc - _gc ); _gc = item.gc;
                res += Vlq.encode( item.of - _of ); _of = item.of;
                res += Vlq.encode( item.ol - _ol ); _ol = item.ol;
                res += Vlq.encode( item.oc - _oc ); _oc = item.oc;
                if ( item.on >= 0 ) { res += Vlq.encode( item.on - _on ); _on = item.on; }
                return res;
            } ).join( ',' )
        } ).join( ';' );
        return `{"version":3,"file":"${
                    path.relative( dir, js_file ) 
                }","sourceRoot":"","sources":[${
                    this.sources.map( x => `"${ SourceMap.rel_with_dot( dir, x ) }"` ).join( "," ) 
                }],"names":[${
                    this.names.map( x => `"${ x }"` ).join( "," )
                }],"mappings":"${
                    mappings
                }"}`;
    }

    static rel_with_dot( from: string, to: string ) : string {
         let res = path.relative( from, to );
         return res.startsWith( '.' + path.sep ) || res.startsWith( '..' + path.sep ) ? res : './' + res;
    }

    /** */
    replace( beg: number, end: number, str: string | SourceMap ) {
        if ( typeof( str ) == 'string' )
            return this.replace( beg, end, new SourceMap( str ) );

        // correction arrays
        let corr_of = new Array<number>(), corr_on = new Array<number>();
        str.sources.forEach( ( file, index ) => corr_of[ index ] = this.filenum( file ) );
        str.names  .forEach( ( name, index ) => corr_on[ index ] = this.namenum( name ) );

        // step 1: removal
        const beg_coords = coords( this.src_content, beg );
        const end_coords = coords( this.src_content, end );
        if ( beg_coords.l < end_coords.l ) {
            // [0,ib] => part to keep from the first line
            let beg_items = this.lines[ beg_coords.l ]; 
            for( let ib = 0; ib < beg_items.length; ++ib ) {
                if ( beg_items[ ib ].gc >= beg_coords.c ) {
                    beg_items.length = ib;
                    break;
                }
            }

            // [ie,...] => part to keep (i.e. to add to beg_items) from the last line
            let end_items = this.lines[ end_coords.l ]; 
            for( let ie = 0; ie < end_items.length; ++ie ) {
                if ( end_items[ ie ].gc >= end_coords.c ) {
                    end_items[ ie ].gc += beg_coords.c - end_coords.c;
                    beg_items.push( end_items[ ie ] );
                }
            }

            // remove intermediate lines
            this.lines.splice( beg_coords.l + 1, end_coords.l - beg_coords.l );
        } else {
            // [0,ia] => unmodifed part, [ia,ib] => removed part
            let ia = 0, items = this.lines[ beg_coords.l ]; 
            for( ; ia < items.length; ++ia )
                if ( items[ ia ].gc >= beg_coords.c )
                    break;
            let ib = ia; 
            for( ; ib < items.length; ++ib )
                if ( items[ ib ].gc >= end_coords.c )
                    break;

            items.splice( ia, ib - ia );
            for( let ind = ia; ind < items.length; ++ind )
                items[ ind ].gc -= end - beg;
        }

        // step 2: insertion
        if ( str.lines.length >= 2 ) {
            // get the end of the first line in `rem`
            let ia = 0, beg_items = this.lines[ beg_coords.l ]; 
            for( ; ia < beg_items.length; ++ia )
                if ( beg_items[ ia ].gc >= beg_coords.c )
                    break;
            const off = nb_cols_at_end( str.src_content ) - beg_coords.c;
            const rem = beg_items.splice( ia, beg_items.length - ia );
            for( let r of rem ) r.gc += off;

            // append data of the first line
            beg_items.push( ...str.lines[ 0 ].map( item => ( { 
                gc: item.gc + beg_coords.c,
                of: corr_of[ item.of ],
                ol: item.ol,
                oc: item.oc,
                on: item.on >= 0 ? corr_on[ item.on ] : -1,
            } ) ) );

            // add the intermediate lines + beginning of the last one
            for( let n = 1; n < str.lines.length; ++n ) {
                this.lines.splice( beg_coords.l + n, 0, str.lines[ n ].map( item => ( { 
                    gc: item.gc,
                    of: corr_of[ item.of ],
                    ol: item.ol,
                    oc: item.oc,
                    on: item.on >= 0 ? corr_on[ item.on ] : -1,
                } ) ) );
            }

            // add the remaining stuff of the final line
            this.lines[ beg_coords.l + str.lines.length - 1 ].push( ...rem );
        } else {
            // on the same line
            const l = str.src_content.length;
            for( let item of this.lines[ beg_coords.l ] )
                if ( item.gc >= beg_coords.c )
                    item.gc += l;
        }

        // replace in this.src_content
        this.src_content = this.src_content.substring( 0, beg ) + str.src_content + this.src_content.substring( end );
    }

    /** */
    remove( beg: number, end: number ) {
        this.replace( beg, end, "" );
    }

    /** */
    append( that: SourceMap | string ) {
        if ( typeof that == "string" )
            return this.append( new SourceMap( that ) );
            
        // append the first line of `that` to the last line of `this`
        if ( that.lines.length ) {
            if ( ! this.lines.length )
                this.lines.push( [] );
            // copy of last line, with offset in gen columns and adapted filenums
            let last_line = this.lines[ this.lines.length - 1 ];
            let off_col = nb_cols_at_end( this.src_content );
            for( let item of that.lines[ 0 ] ) {
                last_line.push( {
                    gc: off_col + item.gc,
                    of: this.filenum( that.sources[ item.of ] ),
                    ol: item.ol,
                    oc: item.oc,
                    on: item.on >= 0 ? this.namenum( that.names[ item.on ] ) : -1,
                } );
            }
            // copy of following lines
            for( let i = 1; i < that.lines.length; ++i ) {
                let items = new Array<SmItem>();
                for( let item of that.lines[ i ] ) {
                    items.push( {
                        gc: item.gc,
                        of: this.filenum( that.sources[ item.of ] ),
                        ol: item.ol,
                        oc: item.oc,
                        on: item.on >= 0 ? this.namenum( that.names[ item.on ] ) : -1,
                    } );
                }
                this.lines.push( items );
            }
        }
        // appending of src_content
        this.src_content += that.src_content;
    }

    filenum( name: string ) {
        let ind = this.sources.indexOf( name );
        return ind >= 0 ? ind : this.sources.push( name ) - 1;
    }

    namenum( name: string ) {
        let ind = this.map_names.get( name );
        if ( ind === undefined )
            this.map_names.set( name, ind = this.names.push( name ) - 1 );
        return ind;
    }

    find_item( line: number, col: number ): SmItem {
        if ( line < this.lines.length ) {
            const items = this.lines[ line ];
            let beg = 0, end = items.length;
            while ( beg < end ) {
                const cur = ( beg + end ) >> 1;
                if ( items[ cur ].gc > col ) {
                    end = cur;
                } else if ( items[ cur ].gc < col ) {
                    beg = cur + 1;
                } else
                    return items[ cur ];
            }
        }
        return null;
    }

    /** `this.src_content` will be `that.src_content`. items of `this` will be "deepen" by those of `that` */
    apply( that: SourceMap ): void {
        // replace src_content
        this.src_content = that.src_content;

        // for each item in `that`, we look if we have something in `this` 
        let new_lines = new Array<Array<SmItem>>();
        for( let that_line of that.lines ) {
            let new_line = new Array<SmItem>();
            for( let that_item of that_line ) {
                const this_item = this.find_item( that_item.ol, that_item.oc );
                if ( this_item ) {
                    this_item.gc = that_item.gc;
                    new_line.push( this_item );
                }
            }
            new_lines.push( new_line );
        }
        this.lines = new_lines;
    }

    deepen_with( deeper_sourcemap: SourceMap ): void {
        for( let line of this.lines ) {
            for( let item of line ) {
                let deeper_item = deeper_sourcemap.find_item( item.ol, item.oc );
                if ( deeper_item ) {
                    item.oc = deeper_item.oc;
                    item.ol = deeper_item.ol;
                    item.of = this.filenum( deeper_sourcemap.sources[ deeper_item.of ] );
                    item.on = deeper_item.on >= 0 ? this.namenum( deeper_sourcemap.names[ deeper_item.on ] ) : -1;
                }
            }
        }
    }

    is_identity( js_name: string ): boolean {
        let ind_js_name = this.sources.indexOf( js_name ); 
        if ( ind_js_name < 0 )
            return false;
        for( let num_line = 0; num_line < this.lines.length; ++num_line )
            for( let item of this.lines[ num_line ] )
                if ( item.ol != num_line || item.gc != item.oc || item.of != ind_js_name )
                    return false;
        return true;
    }


    sources     = new Array<string>();        /** with absolute paths */
    names       = new Array<string>();        /** variable names */
    map_names   = new Map<string,number>();   /**  */
    lines       = new Array<Array<SmItem>>(); /** marks */
    src_content = "";                         /** original source */
}
