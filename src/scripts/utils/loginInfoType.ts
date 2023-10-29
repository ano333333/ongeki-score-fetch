export const loginInfoKeys = [
    "_t",
    "segaId",
    // "_ga_92875CKHN5",
    "_gcl_au",
    "_gid",
    "friendCodeList",
    "userId",
    "_ga_WDQDR0Y1TP",
    "_ga",
];
export type loginInfoKeysType = [
    "_t",
    "segaId",
    // "_ga_92875CKHN5",
    "_gcl_au",
    "_gid",
    "friendCodeList",
    "userId",
    "_ga_WDQDR0Y1TP",
    "_ga"
];
export type loginInfoType = {
    [key in loginInfoKeysType[number]]?: string;
};
