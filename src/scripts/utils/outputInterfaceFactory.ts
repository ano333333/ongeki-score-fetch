import localStorageClass from "./localStorageClass";
import { outputType, optionDataType } from "./optionDataType";
import outputInterface from "./outputInterface";
import downloadOutputClass from "./downloadOutputClass";
import dropboxOutputClass from "./dropboxOutputClass";

const optionDataOutputInterfaceMap = {
    [outputType.download]: downloadOutputClass,
    [outputType.dropbox]: dropboxOutputClass,
};

//localStorageのoptionDataに従い、出力に用いるoutputInterfaceの子クラスを返す
async function getOutputInterface(): Promise<typeof outputInterface> {
    const optiondata = await localStorageClass.get<optionDataType>(
        "optionData"
    );
    if (!optiondata) {
        throw new Error("オプションが未設定です");
    }
    console.log(optiondata);
    const t = optionDataOutputInterfaceMap[optiondata.outputType];
    console.log(t);
    if (!t) {
        throw new Error(
            `内部エラー: class extending outputInterface is not found for ${optiondata.outputType}`
        );
    }
    return t;
}

export default getOutputInterface;
