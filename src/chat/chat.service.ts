import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import {ChannelsGateway} from "../channels/channels.gateway";
import {PasswordDto} from "./dto/password.dto";

@Injectable()
export class ChatService {
  constructor(
      private readonly prisma: PrismaService,
      private readonly channelsGateway: ChannelsGateway
  ) {}

  async getChat(channelId: number, id: number, password: PasswordDto) {
    try {
      const user = await this.prisma.channelUsers.findUnique({
        where: {
          user_id_channel_id: {
            user_id: id,
            channel_id: channelId,
          },
        },
      });

      if (!user) {
        throw new HttpException('You are not in the channel', HttpStatus.FORBIDDEN);
      }

      const channel = await this.prisma.channels.findUnique({
        where: {
          id: channelId,
        }
      })

      if (password && channel.password !== password.password)
        throw new HttpException('Password is wrong', HttpStatus.FORBIDDEN);

      return await this.prisma.chat.findMany({
        where: { channel_id: channelId },
      });
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to retrieve chat', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async sendMessage(channelId: number, senderId: number, messageData: SendMessageDto) {
    try {

      const message = messageData.message;
      let password: string;
      if (messageData.password)
        password = messageData.password;

      const user = await this.prisma.channelUsers.findUnique({
        where: {
          user_id_channel_id: {
            user_id: senderId,
            channel_id: channelId,
          },
        },
      });

      if (!user) {
        throw new HttpException('You are not in the channel', HttpStatus.FORBIDDEN);
      }

      const channel = await this.prisma.channels.findUnique({
        where: {
          id: channelId,
        }
      })

      if (channel.password && channel.password !== password)
        throw new HttpException('Password is Wrong', HttpStatus.FORBIDDEN);

      const mute = await this.prisma.channelMutes.findUnique({
        where: {
          channel_id_user_id: {
            channel_id: channelId,
            user_id: senderId,
          },
        },
      });

      if (mute) {
        throw new HttpException('You are muted in the channel', HttpStatus.FORBIDDEN);
      }

      const newMessage = await this.prisma.chat.create({
        data: {
          channel_id: channelId,
          sent_by_id: senderId,
          ...messageData,
        },
      });
      this.channelsGateway.sendMessageToChannel(channelId, newMessage.message);
      return newMessage;
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to send message', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
