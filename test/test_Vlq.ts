/// <reference path="../node_modules/@types/mocha/index.d.ts"/>

import Vlq from '../src/Vlq';

describe( 'Vlq', () => {
    it( 'should list dependencies', ( done ) => {
        const ori = [ 7, -110 ], str = ori.map( x => Vlq.encode( x ) ).join( "" );
        const dec = Vlq.decoder( str ), res = ori.map( x => dec.read() );
        if ( ori.toString() != res.toString() )
            return done( res );
        done();
    });
});
