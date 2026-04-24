using AutoMapper;
using GymSync.Api.DTOs;
using GymSync.Api.Models;

namespace GymSync.Api.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<User, UserDto>();

        CreateMap<RegisterDto, User>()
            .ForMember(dst => dst.PasswordHash, opt => opt.Ignore())
            .ForMember(dst => dst.Id, opt => opt.Ignore())
            .ForMember(dst => dst.CreatedAt, opt => opt.Ignore())
            .ForMember(dst => dst.UpdatedAt, opt => opt.Ignore())
            .ForMember(dst => dst.IsActive, opt => opt.Ignore())
            .ForMember(dst => dst.TotalCredits, opt => opt.Ignore())
            .ForMember(dst => dst.RemainingCredits, opt => opt.Ignore())
            .ForMember(dst => dst.Availabilities, opt => opt.Ignore())
            .ForMember(dst => dst.MemberAppointments, opt => opt.Ignore())
            .ForMember(dst => dst.PTAppointments, opt => opt.Ignore());
    }
}
