import dropboxStorageDataType from "./dropboxStorageDataType";
import { logicProgressType } from "./logicProgressType";
import { optionDataType } from "./optionDataType";

type localStorageType = {
    logicProgress: logicProgressType[];
    optionData: optionDataType;
    dropboxData: dropboxStorageDataType;
};

export default localStorageType;
