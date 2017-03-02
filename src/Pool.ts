import CompilationNode,
     { Degraded }      from "./CompilationNode"
import * as stringify  from 'json-stable-stringify'

/**
 * signature => CompilationNode
 */
export default
class Pool {
    New( type: string, children: Array<CompilationNode>, args: any, degraded = null as Degraded ): CompilationNode {
        // already created ?
        const signature = Pool.signature( type, children, args, degraded );
        const val = this.m.get( signature );
        if ( val )
            return val;
        const res = new CompilationNode( signature, type, children, args, degraded );
        this.m.set( signature, res );
        return res;
    }

    factory( signature: string ): CompilationNode {
        try {
            return this.m.get( signature ) || this._make_cn( JSON.parse( signature ) );
        } catch ( e ) {
            try {
                console.log( "signature:", JSON.stringify( JSON.parse( signature ), null, 2 ) );
            } catch ( e ) {
                console.log( "signature:", signature );
            }
            throw e;
        }
    }

    _make_cn( dat: [ string, Array<any>, any, { cn: any, mul: number, off: number } ] ): CompilationNode {
        return this.New( dat[ 0 ], dat[ 1 ].map( dat_ch => this._make_cn( dat_ch ) ), dat[ 2 ], dat[ 3 ] ? {
            cn : this._make_cn( dat[ 3 ].cn ),
            mul: dat[ 3 ].mul,
            off: dat[ 3 ].off,
        } : null );
    }

    static stable_part_of_cn( cn: CompilationNode ): Array<any> {
        return Pool.stable_part_of( cn.type, cn.children, cn.args, cn.degraded );
    }

    static stable_part_of( type: string, children: Array<CompilationNode>, args: any, degraded: Degraded ): Array<any> {
        let lst = [ type, children.map( Pool.stable_part_of_cn ), args ];
        if ( degraded ) {
            lst.push( {
                cn : Pool.stable_part_of_cn( degraded.cn ), 
                mul: degraded.mul || null, 
                off: degraded.off || null
            } );
        }
        return lst;
    }

    static signature( type: string, children: Array<CompilationNode>, args: any, degraded = null as Degraded ): string {
        return stringify( Pool.stable_part_of( type, children, args, degraded ) );
    }

    m = new Map<string,CompilationNode>(); /** signature => instance */
}
