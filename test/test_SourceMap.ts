/// <reference path="../node_modules/@types/mocha/index.d.ts"/>
import SourceMap   from '../src/SourceMap';
import * as _      from 'lodash';
import * as assert from 'assert';

function di( lines ) {
    return lines.map( line => line.map( item => `${item.gc}=>${item.ol},${item.oc}` ).join( " " ) ).join( "\n" );
}

describe( 'SourceMap', () => {
    it( '...', () => {
        // make a basic sourcemap
        let sm = new SourceMap( _.range( 5 ).map( x => "0123456" ).join( "\n" ) );
        sm.lines.forEach( ( line, ol ) => "0123456".split("").forEach( ( v, oc ) => line.push( { gc: oc, of: 0, ol, oc, on: -1, } ) ) );

        // remove data from the same line
        sm.replace( 8 * 4 + 1, 8 * 4 + 4, "" );
        assert( di( sm.lines.slice( 4 ) ) == "0=>4,0 1=>4,4 2=>4,5 3=>4,6" );

        // remove data from several lines
        sm.replace( 8 * 2 + 1, 8 * 3 + 4, "" );
        assert( di( sm.lines.slice( 2, 3 ) ) == "0=>2,0 1=>3,4 2=>3,5 3=>3,6" );

        // insertion of a single line
        sm.replace( 8 * 1 + 1, 8 * 1 + 6, "AB" );
        assert( di( sm.lines.slice( 1, 2 ) ) == "0=>1,0 3=>1,6" );

        // insertion of several lines
        sm.replace( 8 * 0 + 1, 8 * 0 + 6, "A\nB" );

        assert( di( sm.lines ) == "0=>0,0\n1=>0,6\n0=>1,0 3=>1,6\n0=>2,0 1=>3,4 2=>3,5 3=>3,6\n0=>4,0 1=>4,4 2=>4,5 3=>4,6" );
        assert( sm.src_content == "0A\nB6\n0AB6\n0456\n0456" );
    });
});
