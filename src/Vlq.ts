const base64_i2c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const base64_c2i = Array( 256 );
for( let i = 0; i < 64; ++i )
    base64_c2i[ base64_i2c.charCodeAt( i ) ] = i;

class VlqDecoder {
    constructor( str: string, pos = 0 ) {
        this.str = str;
        this.pos = pos;
    }
    read() : number {
        let res = 0, shift = 0;
        while ( this.pos < this.str.length ) {
            let val = base64_c2i[ this.str.charCodeAt( this.pos++ ) ];
            if ( val < 32 ) {
                res += val << shift;
                return res & 1 ? - ( res >> 1 ) : ( res >> 1 );
            }
            res += ( val & 31 ) << shift;
            shift += 5;
        }
        return res;
    }
    eof(): boolean {
        return this.pos == this.str.length;
    }
    str: string;
    pos: number;
}

/** https://en.wikipedia.org/wiki/Variable-length_quantity */
export default
class Vlq {
    static encode( val: number ) : string {
        let res = "";
        val = val < 0 ? ( - val << 1 | 1 ) : val << 1;
        for( ; val >= 32; val >>= 5 )
            res += base64_i2c[ 32 + val % 32 ];
        return res += base64_i2c[ val ];
    }
    static decoder( str: string ) {
        return new VlqDecoder( str );
    }
}
