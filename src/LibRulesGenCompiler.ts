
export default 
class LibRulesGenCompiler {
    yaml_name : string;
    includes ?: Array<string>;
    flag_sets?: Array<{
        systems  ?: Array<string>,
        lib_names?: Array<string>,
        lib_paths?: Array<string>,
        exe_paths?: Array<string>,
        inc_paths?: Array<string>,
        no_comp  ?: boolean,
    }>;
    load_sets?: Array<{
        systems?: Array<string>,
        command?: string,
        as_root?: boolean,
    }>;
}
