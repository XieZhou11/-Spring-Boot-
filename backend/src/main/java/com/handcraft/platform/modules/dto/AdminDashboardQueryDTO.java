package com.handcraft.platform.modules.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

/** 看板新增指标日期范围，按北京时间自然日统计。 */
@Getter @Setter
public class AdminDashboardQueryDTO {
    /** 新增指标起始日期，格式 yyyy-MM-dd。 */
    @Pattern(regexp="^$|\\d{4}-\\d{2}-\\d{2}") private String from;
    /** 新增指标结束日期，格式 yyyy-MM-dd。 */
    @Pattern(regexp="^$|\\d{4}-\\d{2}-\\d{2}") private String to;
    /** 日期范围必须同时提供且起始日不晚于结束日。 */
    @AssertTrue(message="起止日期须同时填写且起始日期不能晚于结束日期")
    public boolean isRangeValid(){
        if((from==null||from.isBlank())&&(to==null||to.isBlank()))return true;
        if(from==null||from.isBlank()||to==null||to.isBlank())return false;
        try{return !java.time.LocalDate.parse(from).isAfter(java.time.LocalDate.parse(to));}
        catch(java.time.format.DateTimeParseException e){return false;}
    }
}
