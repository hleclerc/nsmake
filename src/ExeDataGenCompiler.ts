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
    include_strs         = new Array<string>();                   /** strings used in include cmds (not the absolute path). Ex: 'json/json.h' */
    lib_names            = new Array<string>();
    lib_paths            = new Array<string>();
    inc_paths            = new Array<string>();
    // data from nsmake cmds
    // ext_libs             = new Array<{ name: string, url: string, glob: string }>();
}
