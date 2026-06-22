import { transformRecordToOption } from '@/utils/common';
export const yesOrNoRecord = {
  Y: 'common.yesOrNo.yes',
  N: 'common.yesOrNo.no'
};
export const yesOrNoOptions = transformRecordToOption(yesOrNoRecord);
