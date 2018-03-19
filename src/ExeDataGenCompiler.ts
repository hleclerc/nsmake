/** 
 * Outputs of compiler tasks (including CppCompiler, ...)
*/
export default
class ExeDataGenCompiler {
    define               = new Array<string>();
    aliases              = new Array<{key:string,val:string}>();
    cpp_content_is_new   = false;                                 /** if CppCompiler has modified the original src content */
    orig_name            = "";                                    /** name of the "leaf" input javascript/typescript/Coffeescript/... (i.e. the source) */
    error                = false;
    includes             = new Array<string>();
    no_comps             = new Array<string>();                   /** do not look for .cc/.cpp/... files associated with these (header) files */
    include_strs         = new Array<string>();                   /** strings used in include cmds (not the absolute path). Ex: 'json/json.h' */
    lib_names            = new Array<string>();
    lib_paths            = new Array<string>();
    exe_paths            = new Array<string>();
    lib_flags            = new Array<string>();
    inc_paths            = new Array<string>();
    cpp_flags            = new Array<string>();                   /**  */
    obj_names            = new Array<string>();
    //
    command_sgn          = "";                                    /** signature of the command to execute to get the .o file */
    compiler             = "";                                    /** should be also in command_sgn */
    archiver             = "";                                    /**  */
}
