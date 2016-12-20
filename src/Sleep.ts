import Task from "./Task"

/** executable or items args number => num in children
 */
export default
class Sleep extends Task {
    exec( args: { time: number }, done: ( err: boolean ) => void ) {
        this.note( `Waiting ${ args.time }ms...` );
        
        setTimeout( () => done( false ), args.time );
        this.pure_function = false;
    }
}
