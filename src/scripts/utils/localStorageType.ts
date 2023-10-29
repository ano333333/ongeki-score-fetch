import messageToBackgroundType from "./messageToBackgroundType";
import logicProgressType from "./logicProgressType";

type localStorageType = {
    toBackground: messageToBackgroundType[];
    logicProgress: logicProgressType[];
    loginInfoCheck: boolean;
};

export default localStorageType;
