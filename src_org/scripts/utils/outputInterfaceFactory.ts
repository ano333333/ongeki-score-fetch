import localStorageClass from "./localStorageClass";
import { outputType } from "./optionDataType";
import outputInterface from "./outputInterface";
import downloadOutputClass from "./downloadOutputClass";
import dropboxOutputClass from "./dropboxOutputClass";

const optionDataOutputInterfaceMap = {
    [outputType.download]: downloadOutputClass,
    [outputType.dropbox]: dropboxOutputClass,
};

//localStorageのoptionDataに従い、出力に用いるoutputInterfaceの子クラスを返す
async function getOutputInterface(): Promise<typeof outputInterface> {
    const optiondata = await localStorageClass.getOptionData();
    const t = optionDataOutputInterfaceMap[optiondata.outputType];
    if (!t) {
        throw new Error(
            `内部エラー: class extending outputInterface is not found for ${optiondata.outputType}`
        );
    }
    return t;
}

export default getOutputInterface;
