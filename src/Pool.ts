import CompilationNode from "./CompilationNode";
// let HashMap = require( "hashmap" ) as any;


export default
class Pool {
    New( type: string, children: Array<CompilationNode>, args: any ): CompilationNode {
        // already created ?
        const signature = Pool.signature( type, children, args );
        const val = this.m.get( signature );
        if ( val )
            return val;
        const res = new CompilationNode( signature, type, children, args );
        this.m.set( signature, res );
        return res;
    }

    factory( signature: string ): CompilationNode {
        return this.m.get( signature ) || this._make_cn( JSON.parse( signature ) );
    }

    _make_cn( dat: [ string, Array<any>, any ] ): CompilationNode {
        return this.New( dat[ 0 ], dat[ 1 ].map( dat_ch => this._make_cn( dat_ch ) ), dat[ 2 ] );
    }

    static stable_part_of( cn: CompilationNode ) {
        return [ cn.type, cn.children.map( Pool.stable_part_of ), cn.args ];
    }

    static signature( type: string, children: Array<CompilationNode>, args: any ): string {
        return JSON.stringify( [ type, children.map( Pool.stable_part_of ), args ] );
    }

    m = new Map<string,CompilationNode>(); /** signature => instance */
}
