// SPDX-FileCopyrightText: © 2017 EteSync Authors
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from "react";

import MomentUtils from "@date-io/moment";
import { MuiPickersUtilsProvider, KeyboardDatePicker, KeyboardDateTimePicker } from "@material-ui/pickers";

import moment from "moment";

interface PropsType {
  placeholder: string;
  value?: Date;
  dateOnly?: boolean;
  onChange: (date?: Date) => void;
}

class DateTimePicker extends React.PureComponent<PropsType> {
  constructor(props: any) {
    super(props);
    this.handleInputChange = this.handleInputChange.bind(this);
  }

  public render() {
    const Picker = (this.props.dateOnly) ? KeyboardDatePicker : KeyboardDateTimePicker;
    // The input mask is made from the format by replacing each letter with a digit placeholder, so the
    // format has to have exactly one letter per digit: "L" would only allow for typing a single digit.
    const dayFormat = moment.localeData().longDateFormat("L");
    const dateFormat = (this.props.dateOnly) ? dayFormat : `${dayFormat} HH:mm`;
    return (
      <MuiPickersUtilsProvider utils={MomentUtils}>
        <Picker
          value={this.props.value || null}
          onChange={this.handleInputChange}
          format={dateFormat}
          ampm={false}
          showTodayButton
          KeyboardButtonProps={{
            "aria-label": "change date",
          }}
        />
      </MuiPickersUtilsProvider>
    );
  }

  private handleInputChange(date: moment.Moment) {
    if (moment.isMoment(date)) {
      this.props.onChange(date.toDate());
    } else {
      this.props.onChange(undefined);
    }
  }
}

export default DateTimePicker;
