export type logicProgressTypeProgress = {
    type: "progress";
    message: string;
};

export type logicProgressTypeFinish = {
    type: "finish";
};

export type logicProgressTypeError = {
    type: "error";
    message: string;
};

export type logicProgressType =
    | logicProgressTypeProgress
    | logicProgressTypeFinish
    | logicProgressTypeError;
