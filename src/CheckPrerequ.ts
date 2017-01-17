import Task       from "./Task"
import * as async from "async"

export
interface ArgsCheckPrerequ {
    names: Array<string>;
}

/**
 */
export default
class CheckPrerequ extends Task {
    exec( args: ArgsCheckPrerequ, done: ( boolean ) => void ) {
        async.forEach( args.names, ( name, cb ) =>
            this.check_prerequ( name, ( err, fail ) => cb( err || fail ) )
        , done );
    }
}
