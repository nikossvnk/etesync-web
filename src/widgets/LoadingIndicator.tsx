// SPDX-FileCopyrightText: © 2017 EteSync Authors
// SPDX-License-Identifier: AGPL-3.0-only

import CircularProgress from "@material-ui/core/CircularProgress";

export default (props: any) => {
  return (
    <CircularProgress size={60} thickness={7} {...props} />
  );
};
